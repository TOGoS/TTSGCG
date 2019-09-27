import Cut, { identityTransformations } from '../Cut';
import Part from '../Part';
import { translationToTransform } from '../vectormath';
import { boxPath } from '../pathutils';

// A 12" TOGRack panel faceplate thing.

export interface SubpanelOptions {
    width : number; // In inches
    interiorCuts : Cut[]; // Additional cuts, relative to the center of the panel
}

export interface PanelOptions {
    // We can carve panels out of the interior while we're at it!
    subpanels : SubpanelOptions[];
    width : number; // In inches
}

// Panel stuff:
// - OLED screens are 1"x0.57" (the board is about 1.06" square)
// - Round momentary pushbuttons are 0.48" in diameter
// - Male aviation connector shaft is 0.60" (actually 15mm) in diameter

const defaultPanelOptions:PanelOptions = {
    width: 12,
    subpanels: [
        {
            width: 2,
            interiorCuts: [
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
                    depth: Infinity,
                    spaceSide: "left",
                    path: boxPath({
                        cx: 0, cy: 0,
                        width: 1,
                        height: 0.57,
                        cornerOptions: {
                            cornerRadius: 0,
                            cornerStyleName: "Round"
                        }
                    })
                }
            ]
        },
        {
            width: 2,
            interiorCuts: [
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    transformations: [{x:-0.5, y:0}, {x:0.5, y:0}, {x:0, y:-0.75}, {x:0, y:0.75}],
                    components: [
                        {
                            classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
                            diameter: 0.48,
                            depth: Infinity,
                        }
                    ]
                }
            ]
        },
        {
            width: 2,
            interiorCuts: [
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
                    diameter: 0.60,
                    depth: Infinity,
                }
            ],
        },
        {
            width: 3,
            interiorCuts: [],
        }
    ]
}

function mapMany<T,Y>( stuff:T[], cb:(thing:T)=>Y[] ):Y[] {
    return stuff.map(cb).reduce((a,b)=>a.concat(b));
}

export default function makePart(partOptions:PanelOptions=defaultPanelOptions):Part {
    const length = partOptions.width || 12;
    const gridbeamHole:Cut = {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
        diameter: 3/8,
        depth: Infinity,
    };
    const togRackHole:Cut = {
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
        diameter: 5/32,
        depth: Infinity,
    };
    const gridbeamHolePositions = mapMany([0.75,length-0.75], (x) => [0.75, 2.25, 3.75].map( y => ({x, y}) ));
    const togRackHolePositions = [];
    for( let y=0.75; y<=3.75; y += 3 ) {
        for( let x=1.25; x<=length-1.25; x += 0.5 ) { // Avoid gridbeam holes or getting too close to edge
            togRackHolePositions.push({x, y});
        }
    }

    const totalSubpanelWidth = partOptions.subpanels.map( panel => panel.width ).reduce( (l1,l2) => l1+l2, 0 );

    if( totalSubpanelWidth > length - 3 ) {
        throw new Error(`Total length of sub-panels (${totalSubpanelWidth} inches) does not leave room for gridrack mounting holes`);
    }
    if( totalSubpanelWidth % 1 != 0 ) {
        throw new Error(`Total sub-panel length (${totalSubpanelWidth} inches) is not a multiple of 1 inch`);
    }

    const subpanelInteriorCuts:Cut[] = [];
    const subpanelOutlineCuts:Cut[] = [];

    let subpanelOffset = (length - totalSubpanelWidth)/2;
    for( let c in partOptions.subpanels ) {
        const subpanel = partOptions.subpanels[c];
        const centerXf = {x: subpanelOffset + subpanel.width/2, y:4.5/2};
        subpanelInteriorCuts.push({
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
            transformations: [centerXf],
            components: subpanel.interiorCuts
        });
        subpanelOutlineCuts.push({
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
            depth: Infinity,
            spaceSide: "middle",
            path: boxPath({
                x0: subpanelOffset, cy: 4.5/2,
                width: subpanel.width,
                height: 3.5,
                cornerOptions: {
                    cornerRadius: 1/4,
                    cornerStyleName: "Round"
                }
            })
        }, {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/Pause"
        })
        subpanelOffset += subpanel.width;
    }

    return {
        name: "WSTYPE-200045",
        cut: {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
            transformations: identityTransformations,
            unit: {"inch": {numerator:1, denominator:1}},
            components: [
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    transformations: gridbeamHolePositions,
                    components: [gridbeamHole]
                },
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    transformations: togRackHolePositions,
                    components: [togRackHole]
                },
                ...subpanelInteriorCuts,
                ...subpanelOutlineCuts,
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
                    depth: Infinity,
                    spaceSide: "middle",
                    path: boxPath({
                        x0: (length - totalSubpanelWidth)/2, cy: 4.5/2,
                        width: totalSubpanelWidth,
                        height: 3.5,
                        cornerOptions: {
                            cornerRadius: 1/4,
                            cornerStyleName: "Round"
                        }
                    })
                }    
            ]
        }
    }
}
