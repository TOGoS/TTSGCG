import { Vector3D } from "./vectormath";

export interface AABB3D {
	minX:number, minY:number, minZ:number,
	maxX:number, maxY:number, maxZ:number,
}

export function union(a:AABB3D, b:AABB3D):AABB3D {
	return {
		minX: Math.min(a.minX, b.minX),
		minY: Math.min(a.minY, b.minY),
		minZ: Math.min(a.minZ, b.minZ),
		maxX: Math.max(a.maxX, b.maxX),
		maxY: Math.max(a.maxY, b.maxY),
		maxZ: Math.max(a.maxZ, b.maxZ),
	}
}

export function cube(width:number):AABB3D {
	return {
		minX: -width/2, minY: -width/2, minZ: -width/2,
		maxX: +width/2, maxY: +width/2, maxZ: +width/2,
	}
}

export function pad(a:AABB3D, amount:number|AABB3D):AABB3D {
	if( typeof(amount) == "number" ) {
		amount = cube(amount*2);
	}
	return {
		minX: a.minX + amount.minX,
		minY: a.minY + amount.minY,
		minZ: a.minZ + amount.minZ,
		maxX: a.maxX + amount.maxX,
		maxY: a.maxY + amount.maxY,
		maxZ: a.maxZ + amount.maxZ,
	}
}
