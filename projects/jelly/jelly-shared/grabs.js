// SPDX-License-Identifier: GPL-3.0-only
// Each contact owns its body, drag plane and pointer capture. Release only that ID.
export class GrabContacts {
 constructor(canvas){this.canvas=canvas;this.contacts=new Map();}
 get size(){return this.contacts.size;}
 get(id){return this.contacts.get(id);}
 begin(id,body,point,plane){
  if(this.contacts.has(id)||this.size>=10||!body.beginGrab(point,id))return false;
  this.contacts.set(id,{body,plane});
  try{this.canvas.setPointerCapture(id);}catch{this.contacts.delete(id);body.endGrab(id);return false;}
  return true;
 }
 end(id){
  const contact=this.contacts.get(id);if(!contact)return false;
  // Remove ownership before releasePointerCapture can dispatch lostpointercapture.
  this.contacts.delete(id);contact.body.endGrab(id);
  if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
  return true;
 }
 clear(){for(const id of [...this.contacts.keys()])this.end(id);}
}
