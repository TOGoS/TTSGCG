import Cut, { identityTransformations } from "../Cut";
import { boxPath } from "../pathutils";
import Part from "../Part";
import { rectangularArray, rectangularArrayPoints } from "../cuts";
import { number6PanelHole, number6PanelSlot } from "./commonholes";
import { SimpleTransformation2D } from "../Transformish";

export interface TOGRackPanelOptions {
    length : number; // In inches
    holeStyleName? : "circular"|"alternating-ovals",
    extraMargin? : number; // Also in inches
}

export const togRackPanelMountingHole:Cut = number6PanelHole;

/** Generate an array of holes for a TOGRack panel; assumes top-left of panel is 0,0 */
export function makeTogRackPanelHoles(options:TOGRackPanelOptions):Cut {
    const holeStyleName = options.holeStyleName ?? "circular";
    if( holeStyleName == "circular" ) {
        return rectangularArray([togRackPanelMountingHole], {x0: 0.25, y0:0.25, dx: 0.5, dy: 3.0, countX: options.length*2, countY:2});
    } else if( holeStyleName == 'alternating-ovals' ) {
        const wideHolePositions : SimpleTransformation2D[] = [];
        const tallHolePositions : SimpleTransformation2D[]= [];
        for( let i=0; i<options.length*2; ++i ) {
            const topHolePositions    = (i&1) == 0 ? wideHolePositions : tallHolePositions;
            const bottomHolePositions = (i&1) == 0 ? tallHolePositions : wideHolePositions;
            topHolePositions.push(   {x: 0.25 + i*0.5, y:3.25});
            bottomHolePositions.push({x: 0.25 + i*0.5, y:0.25});
        }
        for( let i=0; i<tallHolePositions.length; ++i ) {
            tallHolePositions[i].rotation = {degree: 90};
        }
        return {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
            transformations: identityTransformations,
            components: [
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    transformations: wideHolePositions,
                    components: [number6PanelSlot],
                },
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    transformations: tallHolePositions,
                    components: [number6PanelSlot],
                },
            ]
        };
    } else {
        throw new Error(`Unrecognized TOGRack hole style name: ${holeStyleName}`);
    }
}

export function makeTogRackPanelOutline(options:TOGRackPanelOptions):Cut {
    // Note: spaceSide: "middle" because otherwise I will need to do
    // path-adjustment-based-on-bit-radius calculations, which I haven't
    // yet gotten around to figuring out how to do.
    // This will be a problem if/when I go to use a larger bit.
    const extraMargin = options.extraMargin ?? 0;
    return {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
        depth: Infinity,
        spaceSide: "middle",
        path: boxPath({
            x0: extraMargin, y0: extraMargin,
            width: options.length - extraMargin*2, height: 3.5 - extraMargin*2,
            cornerOptions: {
                cornerRadius: 1/4,
                cornerStyleName: "Round"
            },
        })
    }
}

export function makeTogRackPanelOutlineAndHoles(options:TOGRackPanelOptions):Cut {
    return {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        unit: {"inches": {numerator:1, denominator:1}},
        transformations: identityTransformations,
        components: [
            makeTogRackPanelHoles(options),
            makeTogRackPanelOutline(options),
        ]
    };
}

export default function makePart(options:TOGRackPanelOptions={length: 1.5}):Part {
    return {
        name: "Blank "+options.length+"-inch TOGRack panel",
        cut: makeTogRackPanelOutlineAndHoles(options),
    }
}
