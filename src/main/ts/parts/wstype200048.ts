import Part from "../Part";
import Cut, { identityTransformations } from "../Cut";
import { boxPath } from "../pathutils";
import { makeTogRackPanelOutlineAndHoles } from "./tograckpanel";
import { SimpleTransformation2D } from "../Transformish";
import { rectangularArray } from "../cuts";

/**
 * A 3.5" x 3.5" TOGRack panel
 * with 5 rows of #6 screw hole - hole for switch post - #6 screw hole
 * my switch posts are 1/4" and 1/3" long;
 * bodies are 1/2" the switch-flip way, 0.31" side-to-side, and 0.54" tall, including leads
 * Can I make the panel 3.5" square?  That'd be cute.  No real reason to make it square, though.
 * Could fit up to 5 switches easily, so let's drill 5 holes
 */

const screwHole:Cut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
    depth: Infinity,
    diameter: 5/32,
};

const switchHole:Cut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
    depth: Infinity,
    diameter: 1/4,
};

export default function makePart():Part {
    return {
        cut: {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
            unit: {"inches": {numerator:1, denominator:1}},
            transformations: identityTransformations,
            components: [
                rectangularArray([screwHole], {
                    x0: 0.75, y0: 0.75,
                    countX: 2, dx: 2,
                    countY: 5, dy: 0.5
                }),
                rectangularArray([switchHole], {
                    x0: 3.5/2, y0: 0.75,
                    countX: 1, dx: 1,
                    countY: 5, dy: 0.5
                }),
                makeTogRackPanelOutlineAndHoles({length: 3.5}),
            ],
        },
        name: "WSTYPE-200048"
    }
}
