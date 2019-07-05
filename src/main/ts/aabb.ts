export interface AABB3D {
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
}

export function pad( aabb:AABB3D, amount:number ) {
    return {
        minX: aabb.minX - amount,
        minY: aabb.minY - amount,
        minZ: aabb.minZ - amount,
        maxX: aabb.maxX + amount,
        maxY: aabb.maxY + amount,
        maxZ: aabb.maxZ + amount,
    };
}
