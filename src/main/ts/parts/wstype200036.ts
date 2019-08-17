// TODO: wstype200030, but only 1.5" wide (3 columns instead of 6)

import makeWstype200030LikePart from './wstype200030like';

export default function makePart() {
    return makeWstype200030LikePart({columnCount: 3});
}
