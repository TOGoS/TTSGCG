import Cut, { identityTransformations } from "../Cut";
import { boxPath } from "../pathutils";
import Part from "../Part";
import { rectangularArray, rectangularArrayPoints } from "../cuts";

interface TOGPanelOptions {
    length : number; // In inches
}

export const togRackPanelMountingHole:Cut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
    diameter: 5/32,
    depth: Infinity
};

export function makeTogRackPanelHoles(options:TOGPanelOptions):Cut {
    return rectangularArray([togRackPanelMountingHole], {x0: 0.25, y0:0.25, dx: 0.5, dy: 3.0, countX: options.length*2, countY:2});
}

export function makeTogRackPanelOutline(options:TOGPanelOptions):Cut {
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

export function makeTogRackPanelOutlineAndHoles(options:TOGPanelOptions):Cut {
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

export default function makePart(options:TOGPanelOptions={length: 1.5}):Part {
    return {
        name: "Blank "+options.length+"-inch TOGRack panel",
        cut: makeTogRackPanelOutlineAndHoles(options),
    }
}
