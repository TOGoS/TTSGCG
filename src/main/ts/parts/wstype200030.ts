import Part from '../Part';
import { boxPath } from '../pathutils';

function cat<T>(a:T[],b:T[]):T[] { return a.concat(b); }

export default function makePart():Part {
    let edge:Part = {
        classRef: "http://ns.nuke24.net/RoutedPart/Edge",
        unit: {"inch": {numerator:1, denominator:1}},
        shape: {
            typeName: "CompoundShape",
            components: [
                {
                    typeName: "RoundHoles",
                    diameter: 1/8,
                    positions: [0,1,2,3,4,5].map((col) => {
                        return [0,1,2,3,4,5,6,7,8].map((row) => {
                            if( col == 1 && row % 3 == 1 ) return [];
                            return [{x:col * 0.5 + 0.25, y:row * 0.5 + 0.25, z:0}];
                        }).reduce(cat);
                    }).reduce(cat)
                },
                {
                    typeName: "RoundHoles",
                    diameter: 3/8,
                    positions: [0,1,2].map((row) => ({x:0.75, y:0.75 + 1.5 * row, z:0}))
                },
                boxPath({
                    x0: 0,
                    y0: 0,
                    width: 3,
                    height: 4.5,
                    cornerOptions: {
                        cornerRadius: 0.25,
                        cornerStyleName: "Round"
                    }
                }),
            ]
        }
    }
    return {
        classRef: "http://ns.nuke24.net/RoutedPart/CompoundPart",
        components: [ edge ]
    };
}
