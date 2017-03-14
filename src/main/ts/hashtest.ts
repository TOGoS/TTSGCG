// Make sure we can import and use tshash!

import { sha1Urn } from 'tshash';

const expected = 'urn:sha1:SQ5HALIG6NCZTLXB7DNI56PXFFQDDVUZ';
const urn = sha1Urn("Hello, world!");
if( urn != expected ) {
	throw new Error("SHA-1 URN of 'Hello, world!' didn't match expected: "+urn+" != "+expected);
}
