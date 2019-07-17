import { boxPath } from '../pathutils';
import Cut, { identityTransformations, CompoundCut } from '../Cut';
import Part from '../Part';

function cat<T>(a:T[],b:T[]):T[] { return a.concat(b); }

const flatheadNumberSixHole:CompoundCut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
    transformations: identityTransformations,
    components: [
        {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/ConicPocket",
            diameter: 0.25,
            bottomDiameter: 0.126,
            bottomDepth: (0.25 - 0.126),
            edgeDepth: 0,
            cutsBottom: false,
        },
        {
            classRef:"http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
            diameter: 0.126,
            depth: Infinity,
        }
    ]
} 

export default function makePart():Part {
    const cut:Cut = {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        unit: {"inch": {numerator:1, denominator:1}},
        transformations: identityTransformations,
        components: [
            {
                classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                transformations: [0,1,2,3,4,5].map((col) => {
                    return [0,1,2,3,4,5,6,7,8].map((row) => {
                        if( col == 1 && row % 3 == 1 ) return [];
                        return [{x:col * 0.5 + 0.25, y:row * 0.5 + 0.25}];
                    }).reduce(cat);
                }).reduce(cat),
                components: [flatheadNumberSixHole],
            },
            {
                classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                transformations: [0,1,2].map((row) => ({x:0.75, y:0.75 + 1.5 * row})),
                components: [{
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
                    diameter: 3/8,
                    depth: Infinity,
                }],
            },
            {
                classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
                depth: Infinity,
                spaceSide: "right",
                path: boxPath({
                    x0: 0,
                    y0: 0,
                    width: 3,
                    height: 4.5,
                    cornerOptions: {
                        cornerRadius: 0.25,
                        cornerStyleName: "Round"
                    }
                }),
            }
        ]
    };
    return {
        name: "WSTYPE-200030",
        cut
    };
}
