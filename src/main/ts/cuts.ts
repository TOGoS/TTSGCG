import Cut from "./Cut";
import { SimpleTransformation2D } from "./Transformish";

interface ArrayOptions {
    x0:number, dx:number, countX:number,
    y0:number, dy:number, countY:number,
}

function noZero(x:number):number {
    return x == 0 ? 1 : x;
}

export function rectangularArrayPoints(options:ArrayOptions):SimpleTransformation2D[] {
    const dx = noZero(options.dx);
    const dy = noZero(options.dy);
    const x0 = options.x0;
    const y0 = options.y0;
    const x1 = options.x0 + dx * (options.countX-1);
    const y1 = options.y0 + dy * (options.countY-1);
    const points:SimpleTransformation2D[] = [];
    if( options.dx < options.dy ) {
        for( let y=y0; y<=y1; y+=dy ) {
            for( let x=x0; x<=x1; x+=dx ) {
                points.push({x,y});
            }
        }
    } else {
        for( let x=x0; x<=x1; x+=dx ) {
            for( let y=y0; y<=y1; y+=dy ) {
                points.push({x,y});
            }
        }
    }
    return points;
}

export function rectangularArray(cuts:Cut[], options:ArrayOptions):Cut {
    return {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        transformations: rectangularArrayPoints(options),
        components: cuts,
    };
}
