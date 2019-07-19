import { boxPath } from '../pathutils';
import Cut, { identityTransformations, CompoundCut } from '../Cut';
import Part from '../Part';
import { Vector3D } from '../vectormath';

function lomgHole(x:number,y:number,width:number,height:number):Cut {
    return {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
        depth: Infinity,
        spaceSide: "left",
        path: boxPath({
            cx: x,
            cy: y,
            width: width,
            height: height,
            cornerOptions: {
                cornerRadius: Math.min(width/2, height/2),
                cornerStyleName: "Round"
            }
        })
    }
}

export default function makePart():Part {
    const panelWidth = 20;
    const panelHeight = 60;
    const holeSize = 4; // For M4s
	const mountingHoleSpacing = 9.5;
	let pokeyHolePositions:Vector3D[] = [];
	for( let phRow=0; phRow<=1; ++phRow ) {
		for( let phX=2; phX < panelWidth; phX += 2) {
			pokeyHolePositions.push({x:phX, y:panelHeight/2 + (phRow-0.5)*mountingHoleSpacing, z:0})
		}
    }
    
    const pokeyHoles:Cut = {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        transformations: pokeyHolePositions,
        components: [{
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
            diameter: 0.5,
            depth: 1,
        }],
    }
    const hole1:Cut = lomgHole(panelWidth/2, 10, panelWidth - 10, holeSize);
    const hole2:Cut = lomgHole(panelWidth/2, 50, panelWidth - 10, holeSize);
    const outside:Cut = {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
        depth: Infinity,
        spaceSide: "right",
        path: boxPath({
            x0: 0, y0: 0,
            width: panelWidth,
            height: panelHeight,
            cornerOptions: {
                cornerRadius: 3,
                cornerStyleName: "Round"
            }
        })
    }
    return {
        cut: {
            classRef:"http://ns.nuke24.net/TTSGCG/Cut/Compound",
            transformations: identityTransformations,
            components: [
                pokeyHoles, hole1, hole2, outside
            ]
        },
        name: "WSTYPE-200031",
    }
}
