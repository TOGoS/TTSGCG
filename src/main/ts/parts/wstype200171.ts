/**
 * Design for a widemouth jar lid with cutouts for GX12 and GX16 male panel-mount connectors.
 * See also ./wstype200146.ts, which is similar.
*/

import { decodeComplexAmount } from '../ComplexAmount';
import Cut, { identityTransformations, RoundHole } from '../Cut'
import Part from '../Part'
import { boxPath, circlePath, crossOutlinePath, CrossShape, PathBuilder } from '../pathutils'
import { Path } from '../Shape2D';
import { distanceUnits, millimeters, MM, ONE_MM } from '../units'
import { multiplyTransform, translationToTransform, xyzAxisAngleToTransform } from '../vectormath';
import StandardPartOptions from './StandardPartOptions';

const gx12Cut:RoundHole = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
    diameter: 12,
    depth: Infinity,
};

const gx16Cut:RoundHole = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
    diameter: 16,
    depth: Infinity,
};

const oledCut:Cut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
    path: boxPath({
        width: 27,
        cx: 0, cy: 0,
        height: 19.5,
        cornerOptions: {cornerRadius: 0, cornerStyleName: "Round"}
    }),
    spaceSide: 'left',
    depth: Infinity,
}

export default function makePart(options:StandardPartOptions):Part {
    const isCover = options.variationString == "cover";
    const sketchDepth = decodeComplexAmount(options.sketchDepth, MM, distanceUnits);
    const edgeDepth = options.variationString == "sketch" ? sketchDepth : Infinity;

    const components : Cut[] = [];

    if( !isCover ) throw new Error("Only cover part of WSTYPE-200171 supported for now");

    if( !isCover ) components.push({
        // TODO: Really this should carve out enough wood
        // that the lid fits down into the jar and the ring
        // can fit on over this and the cover.
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
        path: circlePath(25.4 * (2+5/8)/2),
        spaceSide: 'left',
        comment: "Inner edge of widemouth lid inset",
        depth: sketchDepth
    });
    components.push({
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        comment: "GX16 hole",
        transformations: [multiplyTransform(
            translationToTransform({x:13, y:13, z:0}),
            xyzAxisAngleToTransform(0,0,1, -Math.PI/4),
        )],
        components: [gx16Cut],
    });
    components.push({
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        comment: "GX12 hole",
        transformations: [
            translationToTransform({x:25.4 * (-5/8), y: 25.4*(3/8), z:0 })
        ],
        components: [gx12Cut]
    });
    if( !isCover ) components.push({
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
        comment: "OLED hole",
        transformations: [
            translationToTransform({x:0, y: 25.4 * (-5/8), z:0 })
        ],
        components: [oledCut]
    });
    components.push({
        comment: "Outer edge of widemouth lid",
        classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
        path: circlePath(42), // 42 = a little small, 44 = too big!
        spaceSide: 'left',
        depth: edgeDepth,
    });

    return {
        name: "WSTYPE-200171",
        cut: {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
            unit: ONE_MM,
            transformations: identityTransformations,
            components
        }
    }
}
