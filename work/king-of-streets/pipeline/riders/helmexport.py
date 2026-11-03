import bpy,sys
src,out,rb=sys.argv[-3],sys.argv[-2],float(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ms=[o for o in bpy.data.objects if o.type=='MESH']
for o in ms:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if rb<1 and not any(m.name=='Glass' for m in o.data.materials):
        md=o.modifiers.new('d','DECIMATE');md.ratio=rb;bpy.ops.object.modifier_apply(modifier='d')
bpy.ops.object.select_all(action='DESELECT')
for o in ms:o.select_set(True)
bpy.context.view_layer.objects.active=ms[0];bpy.ops.object.join();bpy.context.view_layer.objects.active.name='helmet'
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
