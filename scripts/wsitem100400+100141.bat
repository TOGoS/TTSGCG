rem Run from TTSGCG directory

scripts\makepart.bat ^
    --native-unit=inch --thickness=1/2in ^
    --sketch-depth=1mm ^
    --label-depth=1.5mm ^
    --sketch ^
    --offset=0,0,0 --label="WSITEM-100400" --part=wstype100390 ^
    --offset=4+3/4,0,0 --label="WSITEM-100401" --part=wstype100390 ^
    --output-svg=output\wstype-100400+100401-sketch.svg ^
    --output-gcode=output\wstype-100400+100401-sketch.nc
