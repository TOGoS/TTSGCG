import Cut, { identityTransformations } from "../Cut";
import { boxPath } from "../pathutils";
import Part from "../Part";
import { rectangularArray, rectangularArrayPoints } from "../cuts";
import { number6PanelHole } from "./commonholes";

export interface TOGRackPanelOptions {
    length : number; // In inches
}

export const togRackPanelMountingHole:Cut = number6PanelHole;

/** Generate an array of holes for a TOGRack panel; assumes top-left of panel is 0,0 */
export function makeTogRackPanelHoles(options:TOGRackPanelOptions):Cut {
    return rectangularArray([togRackPanelMountingHole], {x0: 0.25, y0:0.25, dx: 0.5, dy: 3.0, countX: options.length*2, countY:2});
}

export function makeTogRackPanelOutline(options:TOGRackPanelOptions):Cut {
    return {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
        depth: Infinity,
        spaceSide: "middle", 
        path: boxPath({
            x0: 0, y0: 0,
            width: options.length, height: 3.5,
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
