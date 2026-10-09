import sys, numpy as np, cv2
S=sys.argv[1]
b=np.fromfile(f"{S}/work/b.rgb",dtype=np.uint8).reshape(-1,480,360,3)
out=np.lib.format.open_memmap(f"{S}/work/b_sr.npy",mode="w+",dtype=np.uint8,shape=(len(b),1920,1440,3))
sr=cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(f"{S}/models/FSRCNN_x4.pb"); sr.setModel("fsrcnn",4)
for i,fr in enumerate(b):
    x=cv2.fastNlMeansDenoisingColored(cv2.cvtColor(fr,cv2.COLOR_RGB2BGR),None,3,3,5,15)
    out[i]=cv2.cvtColor(sr.upsample(x),cv2.COLOR_BGR2RGB)
    if i%40==0: print(i,flush=True)
out.flush(); print("done")
