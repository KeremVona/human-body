import argparse
import json
import os
import sys
import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Inventory Blender scene objects.")
    parser.add_argument("--out", required=True, help="Output JSON path")
    return parser.parse_args(argv)


def collect_object_paths(collection, prefix: str, by_object: dict[int, list[str]]) -> None:
    for child in collection.children:
        path = f"{prefix}/{child.name}" if prefix else child.name
        for obj in child.objects:
            by_object.setdefault(obj.as_pointer(), []).append(path)
        collect_object_paths(child, path, by_object)


def main() -> None:
    args = parse_args()
    by_object: dict[int, list[str]] = {}
    collect_object_paths(bpy.context.scene.collection, "", by_object)

    objects = []
    for obj in sorted(bpy.data.objects, key=lambda o: o.name):
        is_mesh = obj.type == "MESH" and obj.data is not None
        objects.append(
            {
                "name": obj.name,
                "type": obj.type,
                "collections": sorted(set(by_object.get(obj.as_pointer(), []))),
                "vertices": len(obj.data.vertices) if is_mesh else 0,
                "hasUV": bool(obj.data.uv_layers) if is_mesh else False,
            }
        )

    payload = {
        "blenderVersion": bpy.app.version_string,
        "sourceFile": os.path.basename(bpy.data.filepath),
        "objects": objects,
    }

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
