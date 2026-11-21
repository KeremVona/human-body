import argparse
import json
import math
import os
import sys
import bpy
from mathutils import Matrix, Vector


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
    if rotate_deg != 0.0 or scale != 1.0:
        xform = Matrix.Scale(scale, 4) @ Matrix.Rotation(math.radians(rotate_deg), 4, "Z")
        for obj in planned_objs:
            obj.matrix_world = xform @ obj.matrix_world
        bpy.context.view_layer.update()

    # Center the originBundle bounding box at world origin and apply transforms.
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
