import bpy,sys
bike,rider,out=sys.argv[-3:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=bike)
bpy.ops.import_scene.gltf(filepath=rider)
for o in bpy.data.objects:
    if o.type=='MESH' and not o.name.startswith(('rider','helmet','body','wheel')):
        pass
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
