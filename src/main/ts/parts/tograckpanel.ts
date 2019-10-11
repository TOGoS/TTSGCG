import Cut, { identityTransformations } from "../Cut";
import { boxPath } from "../pathutils";
import Part from "../Part";

interface TOGPanelOptions {
    length : number; // In inches
}

export const togRackPanelMountingHole:Cut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
    diameter: 5/32,
    depth: Infinity
};

export function makeTogRackPanelHoles(options:TOGPanelOptions):Cut {
    const holePositions = [];
    for( let y=0.25; y<=3.25; y += 3 ) {
        for( let x=0.25; x<=options.length-0.25; x += 0.5 ) {
            holePositions.push({x, y});
        }
    }
    return {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        transformations: holePositions,
        components: [togRackPanelMountingHole]
    }
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
