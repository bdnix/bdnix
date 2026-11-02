import bpy,numpy as np,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
b=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/bikes_plain/{b}.glb')
o=bpy.data.objects['body'];m=o.to_mesh();m.transform(o.matrix_world)
bvh=BVHTree.FromPolygons([v.co[:] for v in m.vertices],[p.vertices[:] for p in m.polygons])
print('top surface height y (bike), rows z, cols x:')
xs=[-0.15,-0.10,-0.05,0,0.05,0.10,0.15]
print('      z\\x '+' '.join(f'{x:+.2f}' for x in xs))
for z in np.arange(0.1,-0.75,-0.05):
    row=[]
    for x in xs:
        h=bvh.ray_cast(Vector((x,-z,1.6)),Vector((0,0,-1)),2.0)   # blender (x,-z_gltf,y)
        row.append(f'{h[0].z:.3f}' if h[0] is not None else ' none')
    print(f' z {z:+.2f}   '+' '.join(row))
