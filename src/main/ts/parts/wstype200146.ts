/**
 * Design for a widemouth jar lid with cutouts for power, GX12, and OLED screen.
 * See ProjectNotes2/2021/EnvironmentalSensor/LargemouthPanel.dxf
 * 
 * From ProjectNotes2/2021/EnvironmentalSensor/SensorWiring.org:
 * 
 *   GX12 outer threads are about 11.58mm in diameter.
 *   
 *   The 'panel cutout' described by the [[https://www.digikey.com/en/products/detail/qualtek/771W-X2-01/299903][lamp cord receptacle]]
 *   (IEC 60320 C8) datasheet is "+"-shaped, i.e. two overlapping rectangles,
 *   19.5mm x 12.5mm and 24.5mm x 7.5mm.
 *   
 *   The OLED screen module is 28.4mm x 27.3mm, and the actual screen is 26.7mm x 19.1mm.
 *   
 *   A widemouth jar lid (that I measured) is 3+5/16", and the inset part is 2+5/8" diameter..
*/

import { decodeComplexAmount } from '../ComplexAmount';
import Cut, { identityTransformations, RoundHole } from '../Cut'
import Part from '../Part'
import { boxPath, circlePath, crossOutlinePath, CrossShape, PathBuilder } from '../pathutils'
import { Path } from '../Shape2D';
import { distanceUnits, millimeters, MM, ONE_MM } from '../units'
import { multiplyTransform, translationToTransform, xyzAxisAngleToTransform } from '../vectormath';
import StandardPartOptions from './StandardPartOptions';

const powerInletCutoutDims : CrossShape = {
    tall: { width: 19.5, height: 12.5 },
    wide: { width: 24.5, height: 7.5 },
};

const powerInletCut:Cut = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
    path: crossOutlinePath(powerInletCutoutDims),
    spaceSide: 'left',                    
};

const gx12Cut:RoundHole = {
    classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
    diameter: 12,
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
}

export default function makePart(options:StandardPartOptions):Part {
    const sketchDepth = decodeComplexAmount(options.sketchDepth, MM, distanceUnits);
    const edgeDepth = options.variationString == "sketch" ? sketchDepth : Infinity;

    return {
        name: "WSTYPE-200146",
        cut: {
            classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
            unit: ONE_MM,
            transformations: identityTransformations,
            components: [
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
                    path: circlePath(25.4 * (2+5/8)/2),
                    spaceSide: 'left',
                    comment: "Inner edge of widemouth lid inset",
                    depth: sketchDepth
                },
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    comment: "Power inlet cutout",
                    transformations: [multiplyTransform(
                        translationToTransform({x:13, y:13, z:0}),
                        xyzAxisAngleToTransform(0,0,1, -Math.PI/4),
                    )],
                    components: [powerInletCut]
                },
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    comment: "GX12 hole",
                    transformations: [
                        translationToTransform({x:25.4 * (-5/8), y: 25.4*(3/8), z:0 })
                    ],
                    components: [gx12Cut]
                },
                {
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
                    comment: "OLED hole",
                    transformations: [
                        translationToTransform({x:0, y: 25.4 * (-5/8), z:0 })
                    ],
                    components: [oledCut]
                },
                {
                    comment: "Outer edge of widemouth lid",
                    classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
                    path: circlePath(25.4 * (3+5/16)/2),
                    spaceSide: 'left',
                    depth: edgeDepth,
                }
            ]
        }
    }
}
