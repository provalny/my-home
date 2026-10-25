export function canStore(node){return Boolean(node&&['room','furniture','shelf','drawer','compartment','box'].includes(node.kind)&&!(node.kind==='furniture'&&node.storageEnabled===false));}
