import sys
sys.path.insert(0, 'maplab/maps')
import region_ridge as r
from ridge_shapes import *
L1,L2,L3=r.shapes(); lv=levels([L1,L2,L3])
print('    '+''.join(str(x%10) for x in range(64)))
for y in range(32): print(str(y).rjust(3),''.join(str(lv.get((x,y),'.')) for x in range(64)))
for h,xs,ys in [(1,range(8,18),(18,30)),(2,range(4,14),(8,24)),(1,range(34,45),(14,30)),(2,range(36,60),(10,26)),(3,range(40,54),(4,14))]:
    print(h,[(x,stair_row(lv,x,h,*ys)) for x in xs if stair_row(lv,x,h,*ys) is not None])
