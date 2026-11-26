import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import interpolate_bezier


def sample_spline_world(spline, matrix_world: Matrix) -> list[Vector]:
    """Extracts world-space polyline points from a Blender Curve spline."""
    pts: list[Vector] = []
    if spline.type == "BEZIER":
        bpts = list(spline.bezier_points)
        if len(bpts) < 2:
            return [matrix_world @ p.co.copy() for p in bpts]
        seg_count = len(bpts) if spline.use_cyclic_u else len(bpts) - 1
        for i in range(seg_count):
            p0 = bpts[i]
            p1 = bpts[(i + 1) % len(bpts)]
            interp = interpolate_bezier(p0.co, p0.handle_right, p1.handle_left, p1.co, 8)
            start_idx = 0 if i == 0 else 1
            for pt in interp[start_idx:]:
                pts.append(matrix_world @ pt)
        return pts
    for p in spline.points:
        pts.append(matrix_world @ Vector(p.co[:3]))
    if spline.use_cyclic_u and pts:
        pts.append(pts[0].copy())
    return pts


def polyline_length(pts: list[Vector]) -> float:
    return sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))


def chain_splines(splines: list[list[Vector]], max_gap: float = 0.002) -> list[Vector]:
    """Starts from the longest spline and chains end-to-end splines within max_gap."""
    non_empty = [s for s in splines if len(s) >= 2]
    if not non_empty:
        return list(splines[0]) if splines else []
    longest_idx = max(range(len(non_empty)), key=lambda i: polyline_length(non_empty[i]))
    chain = list(non_empty[longest_idx])
    remaining = [s for idx, s in enumerate(non_empty) if idx != longest_idx]
    while remaining:
        best_idx = None
        best_dist = max_gap
        append_to_end = True
        reverse_seg = False
        cur_start = chain[0]
        cur_end = chain[-1]
        for idx, seg in enumerate(remaining):
            candidates = [
                ((cur_end - seg[0]).length, True, False),
                ((cur_end - seg[-1]).length, True, True),
                ((cur_start - seg[-1]).length, False, False),
                ((cur_start - seg[0]).length, False, True),
            ]
            for dist, at_end, rev in candidates:
                if dist <= best_dist:
                    best_dist = dist
                    best_idx = idx
                    append_to_end = at_end
                    reverse_seg = rev
        if best_idx is None:
            break
        chosen = list(remaining.pop(best_idx))
        if reverse_seg:
            chosen.reverse()
        if append_to_end:
            chain.extend(chosen[1:] if (chain[-1] - chosen[0]).length < 1e-6 else chosen)
        else:
            prefix = chosen[:-1] if (chosen[-1] - chain[0]).length < 1e-6 else chosen
            chain = prefix + chain
    return chain


def extract_curve_centerlines(entries: list[dict]) -> dict[str, list[Vector]]:
    """Extracts world-space curve centerlines prior to mesh conversion/object cleanup."""
    if not entries:
        return {}
    missing = [e["source"] for e in entries if e["source"] not in bpy.data.objects]
    if missing:
        print(
            f"Missing centerline curve objects in .blend ({len(missing)}): {', '.join(missing)}",
            file=sys.stderr,
        )
        sys.exit(1)

    result: dict[str, list[Vector]] = {}
    for entry in entries:
        obj = bpy.data.objects[entry["source"]]
        if obj.type != "CURVE":
            print(
                f"Centerline source '{entry['source']}' has type {obj.type}, expected CURVE",
                file=sys.stderr,
            )
            sys.exit(1)
        mw = obj.matrix_world.copy()
        splines = [sample_spline_world(sp, mw) for sp in obj.data.splines]
        pts = chain_splines(splines)
        if entry.get("reverse"):
            pts.reverse()
        result[entry["id"]] = pts
    return result


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Export planned bundles as GLB.")
    parser.add_argument("--plan", required=True, help="Path to export-plan.json")
    parser.add_argument("--out", required=True, help="Output directory for raw GLBs")
    return parser.parse_args(argv)


def unexclude_collections(layer_coll, target_objs: set) -> bool:
    has_target = any(obj in target_objs for obj in layer_coll.collection.objects)
    for child in layer_coll.children:
        if unexclude_collections(child, target_objs):
            has_target = True
    if has_target:
        layer_coll.exclude = False
        layer_coll.hide_viewport = False
        layer_coll.collection.hide_viewport = False
        layer_coll.collection.hide_select = False
    return has_target


def select_only(objs: list) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]


def main() -> None:
    args = parse_args()
    with open(os.path.abspath(args.plan), "r", encoding="utf-8") as f:
        plan = json.load(f)

    planned_entries = [
        entry
        for bundle in plan["bundles"]
        for entry in bundle["objects"]
    ]
    missing = [
        entry["source"]
        for entry in planned_entries
        if entry["source"] not in bpy.data.objects
    ]
    if missing:
        print(
            f"Missing planned objects in .blend ({len(missing)}): {', '.join(missing)}",
            file=sys.stderr,
        )
        sys.exit(1)

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    curve_entries = plan.get("centerlines", [])
    curve_centerlines = extract_curve_centerlines(curve_entries)

    planned_objs = [bpy.data.objects[entry["source"]] for entry in planned_entries]
    planned_set = set(planned_objs)

    # Ensure every planned object's LayerCollection chain is enabled and visible.
    unexclude_collections(bpy.context.view_layer.layer_collection, planned_set)

    # Clear visibility drivers from Z-Anatomy before unhiding and unparenting.
    for obj in planned_objs:
        if obj.animation_data:
            obj.animation_data_clear()
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_select = False

    if planned_objs:
        select_only(planned_objs)
        bpy.ops.object.make_single_user(object=True, obdata=True)
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
        bpy.ops.object.convert(target="MESH")

    for obj in planned_objs:
        obj.constraints.clear()
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_select = False

    # Drop all non-planned objects now that modifiers are baked into planned meshes.
    for obj in list(bpy.data.objects):
        if obj not in planned_set:
            bpy.data.objects.remove(obj, do_unlink=True)

    # Apply configured rotation around Z and uniform scale around world origin.
    rotate_deg = float(plan.get("rotateZDeg", 0))
    scale = float(plan.get("scale", 1))
    xform = Matrix.Identity(4)
    if rotate_deg != 0.0 or scale != 1.0:
        xform = Matrix.Scale(scale, 4) @ Matrix.Rotation(math.radians(rotate_deg), 4, "Z")
        for obj in planned_objs:
            obj.matrix_world = xform @ obj.matrix_world
        bpy.context.view_layer.update()

    # Center the originBundle bounding box at world origin and apply transforms.
    offset = Matrix.Identity(4)
    origin_bundle_id = plan["originBundle"]
    origin_bundle = next(
        (b for b in plan["bundles"] if b["id"] == origin_bundle_id),
        None,
    )
    if origin_bundle and origin_bundle["objects"]:
        origin_objs = [bpy.data.objects[e["source"]] for e in origin_bundle["objects"]]
        depsgraph = bpy.context.evaluated_depsgraph_get()
        mins = [float("inf")] * 3
        maxs = [float("-inf")] * 3
        for obj in origin_objs:
            eval_obj = obj.evaluated_get(depsgraph)
            for corner in eval_obj.bound_box:
                wc = eval_obj.matrix_world @ Vector(corner)
                for i in range(3):
                    mins[i] = min(mins[i], wc[i])
                    maxs[i] = max(maxs[i], wc[i])
        center = Vector(
            (
                (mins[0] + maxs[0]) * 0.5,
                (mins[1] + maxs[1]) * 0.5,
                (mins[2] + maxs[2]) * 0.5,
            )
        )
        offset = Matrix.Translation(-center)
        for obj in planned_objs:
            obj.matrix_world = offset @ obj.matrix_world
        bpy.context.view_layer.update()

    total_xform = offset @ xform

    if planned_objs:
        select_only(planned_objs)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    bundle_objects: dict[str, list] = {}
    for bundle in plan["bundles"]:
        objs = []
        for entry in bundle["objects"]:
            obj = bpy.data.objects[entry["source"]]
            obj.name = entry["meshId"]
            if obj.data:
                obj.data.name = entry["meshId"]
                obj.data.materials.clear()
            objs.append(obj)
        bundle_objects[bundle["id"]] = objs

    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    if curve_centerlines:
        curves_out = {}
        for cid, pts in curve_centerlines.items():
            yup = []
            for raw_pt in pts:
                p = total_xform @ raw_pt
                yup.append([round(p.x, 4), round(p.z, 4), round(-p.y, 4)])
            curves_out[cid] = yup
        curves_path = os.path.join(out_dir, "centerlines-curves.json")
        with open(curves_path, "w", encoding="utf-8") as cf:
            json.dump(curves_out, cf, indent=2)
            cf.write("\n")
        print(f"Exported {len(curves_out)} curve centerlines -> {curves_path}")

    for bundle in plan["bundles"]:
        bundle_id = bundle["id"]
        objs = bundle_objects[bundle_id]
        if not objs:
            continue
        select_only(objs)
        filepath = os.path.join(out_dir, f"{bundle_id}.glb")
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_materials="NONE",
            export_yup=True,
            export_cameras=False,
            export_lights=False,
            export_animations=False,
            export_skins=False,
            export_morph=False,
            export_extras=False,
        )
        print(f"Exported {bundle_id}: {len(objs)} meshes -> {filepath}")


if __name__ == "__main__":
    main()
