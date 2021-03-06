import ComplexAmount from './ComplexAmount';

export interface Vector3D { x:number, y:number, z:number }

export interface TransformationMatrix3D {
	xx:number, xy:number, xz:number, x1:number,
	yx:number, yy:number, yz:number, y1:number,
	zx:number, zy:number, zz:number, z1:number,
}

export function createIdentityTransform():TransformationMatrix3D {
	return {
		xx:1, xy:0, xz:0, x1:0,
		yx:0, yy:1, yz:0, y1:0,
		zx:0, zy:0, zz:1, z1:0,
	};
}

export function translationToTransform(v:Vector3D):TransformationMatrix3D {
	return {
		xx:1, xy:0, xz: 0, x1:v.x,
		yx:0, yy:1, yz: 0, y1:v.y,
		zx:0, zy:0, zz: 1, z1:v.z,
	}
}

export function scaleToTransform(s:number|Vector3D):TransformationMatrix3D {
	if( typeof(s) == 'number' ) {
		s = {x:s, y:s, z:s};
	}
	return {
		xx:s.x, xy:0, xz: 0, x1:0,
		yx:0, yy:s.y, yz: 0, y1:0,
		zx:0, zy:0, zz: s.z, z1:0,
	}
}

export function multiplyTransform(m1:TransformationMatrix3D, m2:TransformationMatrix3D):TransformationMatrix3D {
	const xx = m1.xx * m2.xx + m1.xy * m2.yx + m1.xz * m2.zx + 0;
	const xy = m1.xx * m2.xy + m1.xy * m2.yy + m1.xz * m2.zy + 0;
	const xz = m1.xx * m2.xz + m1.xy * m2.yz + m1.xz * m2.zz + 0;
	const x1 = m1.xx * m2.x1 + m1.xy * m2.y1 + m1.xz * m2.z1 + m1.x1;
	const yx = m1.yx * m2.xx + m1.yy * m2.yx + m1.yz * m2.zx + 0;
	const yy = m1.yx * m2.xy + m1.yy * m2.yy + m1.yz * m2.zy + 0;
	const yz = m1.yx * m2.xz + m1.yy * m2.yz + m1.yz * m2.zz + 0;
	const y1 = m1.yx * m2.x1 + m1.yy * m2.y1 + m1.yz * m2.z1 + m1.y1;
	const zx = m1.zx * m2.xx + m1.zy * m2.yx + m1.zz * m2.zx + 0;
	const zy = m1.zx * m2.xy + m1.zy * m2.yy + m1.zz * m2.zy + 0;
	const zz = m1.zx * m2.xz + m1.zy * m2.yz + m1.zz * m2.zz + 0;
	const z1 = m1.zx * m2.x1 + m1.zy * m2.y1 + m1.zz * m2.z1 + m1.z1;
	return {
		xx, xy, xz, x1,
		yx, yy, yz, y1,
		zx, zy, zz, z1
	};
}

export function transformVector(m:TransformationMatrix3D, vec:Vector3D):Vector3D {
	return {
		x: m.xx*vec.x + m.xy*vec.y + m.xz*vec.z + m.x1,
		y: m.yx*vec.x + m.yy*vec.y + m.yz*vec.z + m.y1,
		z: m.zx*vec.x + m.zy*vec.y + m.zz*vec.z + m.z1,
	};
}

export function xyzAxisAngleToTransform( x:number, y:number, z:number, angle:number):TransformationMatrix3D {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const t = 1-c;
	// http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToMatrix/
	return {
		xx:t*x*x + c  , xy:t*x*y - z*s, xz:t*x*z + y*s, x1:0,
		yx:t*x*y + z*s, yy:t*y*y + c  , yz:t*y*z - x*s, y1:0,
		zx:t*x*z - y*s, zy:t*y*z + x*s, zz:t*z*z + c  , z1:0
	};
}

export function axisAngleToTransform( axis:Vector3D, angle:number, dest:TransformationMatrix3D):TransformationMatrix3D {
	return xyzAxisAngleToTransform(axis.x, axis.y, axis.z, angle);
}

export function vectorsAreEqual( v1:Vector3D, v2:Vector3D ):boolean {
	return v1.x == v2.x && v1.y == v2.y && v1.z == v2.z;
}

export function vectorLength( v:Vector3D ):number {
	return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
}

export function scaleVector( v:Vector3D, scale:number ):Vector3D {
	return {
		x: v.x * scale,
		y: v.y * scale,
		z: v.z * scale,
	};
}

export function normalizeVector( v:Vector3D ):Vector3D {
	const len = vectorLength(v);
	if( len == 0 || len == 1 ) return v;
	return scaleVector(v, 1 / len);
}

export function subtractVectors( minuend:Vector3D, subtrahend:Vector3D ):Vector3D {
	return {
		x: minuend.x - subtrahend.x,
		y: minuend.y - subtrahend.y,
		z: minuend.z - subtrahend.z,
	};
}

export function addVectors( ...vectors:Vector3D[] ):Vector3D {
	let x = 0, y = 0, z = 0;
	for( let v in vectors ) {
		x += vectors[v].x;
		y += vectors[v].y;
		z += vectors[v].z;
	}
	return {x,y,z};
}

export const zeroVector = {x:0,y:0,z:0};
Object.freeze(zeroVector);
export const identityTransformation = createIdentityTransform();
Object.freeze(identityTransformation);
