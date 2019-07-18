import { identityTransformations, CompoundCut } from "../Cut";

export const flatheadNumberSixHole:CompoundCut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
    unit: {inch: {numerator:1, denominator:1}},
    transformations: identityTransformations,
    components: [
        {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/ConicPocket",
            diameter: 0.25,
            edgeDepth: 0,
            bottomDiameter: 0.126,
            bottomDepth: (0.25 - 0.126)/2,
            cutsBottom: false,
        },
        {
            classRef:"http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
            diameter: 0.126,
            depth: Infinity,
        }
    ]
} 
