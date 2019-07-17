import RationalNumber from './RationalNumber';

export default interface Unit {
    name: string,
    unitValue: RationalNumber,
    abbreviation: string,
    aliases: string[],
};

export type UnitTable = {[k:string]:Unit};

export function findUnit(name:string, table:UnitTable):Unit|undefined {
    if( table[name] ) return table[name];
	for( let du in table ) {
		let unit = table[du];
		for( let a in unit.aliases ) {
			if( unit.aliases[a] == name ) return unit;
		}
	}
	return undefined;
}

export function getUnit(name:string, table:UnitTable):Unit {
	let unit = findUnit(name, table);
	if( unit == undefined ) throw new Error("No such distance unit as '"+name+"'");
	return unit;
}
