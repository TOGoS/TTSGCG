import * as vectormath from './vectormath';
import { TransformationMatrix3D } from './vectormath';
import ComplexAmount from './ComplexAmount';
import DegreeAngle from './DegreeAngle';

export interface SimpleTransformation2D {
	x:number, y:number,
	z?:number,
	rotation?:DegreeAngle, scale?:number
}

type Transformish = TransformationMatrix3D|SimpleTransformation2D;

function isTransformationMatrix3D(ish:Transformish):ish is TransformationMatrix3D {
	return (ish as TransformationMatrix3D).xx != undefined;
}

export function toTransformationMatrix3D(ish:Transformish):TransformationMatrix3D {
    if( isTransformationMatrix3D(ish) ) return ish;

	let translation = {
		xx:1, xy:0, xz: 0, x1:ish.x,
		yx:0, yy:1, yz: 0, y1:ish.y,
		zx:0, zy:0, zz: 1, z1:ish.z ?? 0,
    };
    let rotation = vectormath.xyzAxisAngleToTransform(0, 0, 1, ish.rotation != undefined ? ish.rotation.degree * Math.PI / 180 : 0);
    let scalation = vectormath.scaleToTransform(ish.scale ?? 1);
    return vectormath.multiplyTransform(translation, vectormath.multiplyTransform(rotation, scalation));
}

export default Transformish;
