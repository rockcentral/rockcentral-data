/* Richard Morton pilot: public reader for Comedian Site Builder v0.1.
 * Existing homepage stays presentation-only; content lives in the protected CMS.
 */
(async function(){
 const byId=id=>document.getElementById(id);
 function el(tag,text,cls){const x=document.createElement(tag);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x;}
 function visible(node,yes){if(node)node.hidden=!yes;}
 function sameSiteUrl(url){try{const u=new URL(url,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
 try{
  const response=await fetch('/Richard/site-data.php',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('Site content unavailable');
  const data=await response.json(),s=data.sections||{};
  for(const section of ['reviews','watch','music']){
   visible(byId(section),s[section]!==false);
   visible(document.querySelector('[data-nav-section="'+section+'"]'),s[section]!==false);
  }
  const showGigs=!!s.gigs;
  visible(byId('dates'),showGigs);
  visible(document.querySelector('[data-nav-section="gigs"]'),showGigs);
  if(showGigs){
   const list=byId('builder-gigs');
   if(list){
    list.replaceChildren();
    const gigs=Array.isArray(data.gigs)?data.gigs:[];
    if(!gigs.length){list.append(el('p','No confirmed dates currently listed. Please check back.','builder-empty'));}
    for(const gig of gigs){
     const box=el('article',null,'builder-gig');
     const dt=el('div',null,'builder-gig-date');
     const date=new Date(gig.date+'T12:00:00');
     dt.textContent=Number.isNaN(date.getTime())?gig.date:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(date);
     const place=el('div',null,'builder-gig-place');
     place.append(el('strong',gig.venue||'Venue to be confirmed'));
     if(gig.town)place.append(el('span',gig.town));
     const action=el('div',null,'builder-gig-action');
     if(gig.time)action.append(el('span',gig.time+' · '));
     const href=gig.ticket_url?sameSiteUrl(gig.ticket_url):null;
     if(href){const a=el('a','Book tickets');a.href=href;a.rel='noopener noreferrer';a.target='_blank';action.append(a);}
     else action.append(el('span','Ticket information to follow'));
     box.append(dt,place,action);list.append(box);
    }
   }
  }
  const news=byId('latest-news'),items=byId('builder-news');
  visible(news,!!s.news);
  visible(document.querySelector('[data-nav-section="news"]'),!!s.news);
  if(s.news && items){
   items.replaceChildren();
   const articles=Array.isArray(data.articles)?data.articles:[];
   if(!articles.length){items.append(el('p','Richard has not published an update yet.'));}
   for(const a of articles){
    const card=el('article',null,'builder-news-card');
    const anchor=el('a',null,'builder-news-link');
    anchor.href=a.url||'/Richard/news/';
    if(a.image&&/^\/Richard\/media\/[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/.test(a.image)){
     const img=el('img');img.src=a.image;img.alt='';img.loading='lazy';anchor.append(img);
    }
    anchor.append(el('h3',a.title));
    card.append(anchor,el('p',a.excerpt||''));items.append(card);
   }
  }
 }catch(error){
  console.warn('Richard content engine could not be loaded:',error);
  // Optional content stays hidden if the feed is unavailable.
 }
})();
