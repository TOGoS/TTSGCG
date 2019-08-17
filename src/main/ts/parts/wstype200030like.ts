import { boxPath } from '../pathutils';
import Cut, { identityTransformations, CompoundCut } from '../Cut';
import Part from '../Part';
import { SimpleTransformation2D } from '../Transformish';

function cat<T>(a:T[],b:T[]):T[] { return a.concat(b); }

const flatheadNumberSixHole:CompoundCut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
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

function mapMany<T,Y>( stuff:T[], cb:(thing:T)=>Y[] ):Y[] {
    return stuff.map(cb).reduce((a,b)=>a.concat(b));
}

interface WSTYPE200030LikeOptions {
    columnCount : number;
}

export default function makePart(options:WSTYPE200030LikeOptions):Part {
    const lhColumnOffset = 1;
    const lhRowOffset = 1;
    const smallHoleTransforms:SimpleTransformation2D[] = [];
    const largeHoleTransforms:SimpleTransformation2D[] = [];
    for( let col=0; col<options.columnCount; ++col ) {
        for( let row=0; row<9; ++row ) {
            (( col % 3 == lhColumnOffset && row % 3 == lhRowOffset ) ? largeHoleTransforms : smallHoleTransforms).push(
                {x:col * 0.5 + 0.25, y:row * 0.5 + 0.25}
            )
        }
    }
    const cut:Cut = {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        unit: {"inch": {numerator:1, denominator:1}},
        transformations: identityTransformations,
        components: [
            {
                classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                transformations: smallHoleTransforms,
                components: [flatheadNumberSixHole],
            },
            {
                classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                transformations: largeHoleTransforms,
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
                    width: options.columnCount * 0.5,
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
