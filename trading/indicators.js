(function(root){
"use strict";
const names=[
"Moving Average","Exponential Moving Average","Smoothed Moving Average","Linear Weighted Moving Average",
"Bollinger Bands","Envelopes","Ichimoku Kinko Hyo","Parabolic SAR","Standard Deviation",
"Average Directional Movement Index","Average True Range","Bears Power","Bulls Power",
"Commodity Channel Index","DeMarker","Force Index","MACD","Momentum",
"Moving Average of Oscillator","Relative Strength Index","Relative Vigor Index",
"Stochastic Oscillator","Williams Percent Range","Accumulation/Distribution",
"Money Flow Index","On Balance Volume","Volumes","Alligator","Awesome Oscillator",
"Accelerator Oscillator"
];
const mean=(a)=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const sma=(a,p)=>a.map((_,i)=>i+1<p?null:mean(a.slice(i-p+1,i+1)));
const ema=(a,p)=>{const out=[];let v=null,k=2/(p+1);a.forEach((x,i)=>{v=v===null?x:x*k+v*(1-k);out.push(i+1<p?null:v)});return out};
const smma=(a,p)=>{const out=[];let v=null;a.forEach((x,i)=>{v=i===p-1?mean(a.slice(0,p)):i>=p?((v*(p-1)+x)/p):null;out.push(v)});return out};
const wma=(a,p)=>a.map((_,i)=>{if(i+1<p)return null;let n=0,d=0;for(let j=0;j<p;j++){n+=a[i-p+1+j]*(j+1);d+=j+1}return n/d});
const std=(a)=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
function calculate(rows){
 if(!Array.isArray(rows)||rows.length<2)return {};
 const c=rows.map(x=>Number(x.close)),h=rows.map(x=>Number(x.high)),l=rows.map(x=>Number(x.low)),o=rows.map(x=>Number(x.open)),v=rows.map(x=>Number(x.volume||0)),n=c.length;
 if(rows.some((x,i)=>![c[i],h[i],l[i],o[i]].every(Number.isFinite)))return {};
 const sma20=sma(c,20),ema12=ema(c,12),ema26=ema(c,26),ema20=ema(c,20),sma5=sma(c,5),sma34=sma(c,34);
 const tr=rows.map((x,i)=>i===0?h[i]-l[i]:Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));
 const atr14=sma(tr,14);
 const gain=[],loss=[];for(let i=0;i<n;i++){const d=i?c[i]-c[i-1]:0;gain.push(Math.max(0,d));loss.push(Math.max(0,-d))}
 const avgGain=smma(gain,14),avgLoss=smma(loss,14);
 const rsi=c.map((_,i)=>avgGain[i]===null?null:avgLoss[i]===0?100:100-100/(1+avgGain[i]/avgLoss[i]));
 const upper=[],lower=[],middle=[];for(let i=0;i<n;i++){if(i<19){upper.push(null);lower.push(null);middle.push(null)}else{const a=c.slice(i-19,i+1),m=mean(a),s=std(a);middle.push(m);upper.push(m+2*s);lower.push(m-2*s)}}
 const high14=[],low14=[];for(let i=0;i<n;i++){high14.push(i<13?null:Math.max(...h.slice(i-13,i+1)));low14.push(i<13?null:Math.min(...l.slice(i-13,i+1)))}
 const typical=rows.map((_,i)=>(h[i]+l[i]+c[i])/3);
 const cci=typical.map((x,i)=>{if(i<19)return null;const a=typical.slice(i-19,i+1),m=mean(a),dev=mean(a.map(z=>Math.abs(z-m)));return dev? (x-m)/(.015*dev):0});
 const demUp=[],demDown=[];for(let i=0;i<n;i++){demUp.push(i?Math.max(h[i]-h[i-1],0):0);demDown.push(i?Math.max(l[i-1]-l[i],0):0)}
 const dem=demUp.map((_,i)=>{if(i<13)return null;const u=mean(demUp.slice(i-13,i+1)),d=mean(demDown.slice(i-13,i+1));return u+d?u/(u+d):0});
 const force=c.map((x,i)=>i? (x-c[i-1])*v[i]:null);
 const moneyFlow=typical.map((x,i)=>x*v[i]);
 const positiveFlow=moneyFlow.map((x,i)=>i&&x>moneyFlow[i-1]?x:0),negativeFlow=moneyFlow.map((x,i)=>i&&x<moneyFlow[i-1]?x:0);
 const mfi=moneyFlow.map((_,i)=>{if(i<13)return null;const p=positiveFlow.slice(i-13,i+1).reduce((a,b)=>a+b,0),q=negativeFlow.slice(i-13,i+1).reduce((a,b)=>a+b,0);return q===0?100:100-100/(1+p/q)});
 const obv=[];for(let i=0;i<n;i++)obv.push(i?obv[i-1]+(c[i]>c[i-1]?v[i]:c[i]<c[i-1]?-v[i]:0):v[i]);
 const ad=[];for(let i=0;i<n;i++){const m=h[i]===l[i]?0:((c[i]-l[i])-(h[i]-c[i]))/(h[i]-l[i]);ad.push((i?ad[i-1]:0)+m*v[i])}
 const ao=c.map((_,i)=>i<33?null:mean(typical.slice(i-4,i+1))-mean(typical.slice(i-33,i+1)));
 const ac=ao.map((x,i)=>x===null||i<4?null:x-mean(ao.slice(i-4,i+1)));
 const macd=ema12.map((x,i)=>x===null||ema26[i]===null?null:x-ema26[i]);
 const signal=ema(macd.map(x=>x===null?0:x),9);
 const adx=rows.map((_,i)=>{if(i<14)return null;const up=[],dn=[];for(let j=i-13;j<=i;j++){const u=j? h[j]-h[j-1]:0,d=j?l[j-1]-l[j]:0;up.push(u>d&&u>0?u:0);dn.push(d>u&&d>0?d:0)}const p=up.reduce((a,b)=>a+b,0),q=dn.reduce((a,b)=>a+b,0),t=tr.slice(i-13,i+1).reduce((a,b)=>a+b,0);return t?100*Math.abs(p-q)/(p+q||1):0});
 const stoch=rows.map((_,i)=>{if(i<13)return null;const hh=Math.max(...h.slice(i-13,i+1)),ll=Math.min(...l.slice(i-13,i+1));return hh===ll?50:100*(c[i]-ll)/(hh-ll)});
 const rvi=rows.map((_,i)=>{if(i<9)return null;let num=0,den=0;for(let j=i-9;j<=i;j++){num+=c[j]-o[j];den+=h[j]-l[j]}return den?num/den:0});
 const sar=[];let rising=true,ep=h[0],s=l[0],af=.02;for(let i=0;i<n;i++){if(i>0){s=s+af*(ep-s);if(rising){s=Math.min(s,l[i-1],i>1?l[i-2]:l[i-1]);if(l[i]<s){rising=false;s=ep;ep=l[i];af=.02}else if(h[i]>ep){ep=h[i];af=Math.min(.2,af+.02)}}else{s=Math.max(s,h[i-1],i>1?h[i-2]:h[i-1]);if(h[i]>s){rising=true;s=ep;ep=h[i];af=.02}else if(l[i]<ep){ep=l[i];af=Math.min(.2,af+.02)}}}sar.push(s)}
 const ichi=rows.map((_,i)=>{if(i<51)return null;const hh9=Math.max(...h.slice(i-8,i+1)),ll9=Math.min(...l.slice(i-8,i+1)),hh26=Math.max(...h.slice(i-25,i+1)),ll26=Math.min(...l.slice(i-25,i+1));return {tenkan:(hh9+ll9)/2,kijun:(hh26+ll26)/2,senkouA:((hh9+ll9)/2+(hh26+ll26)/2)/2}});
 const envelopes=ema20.map(x=>x===null?null:{upper:x*1.01,lower:x*.99});
 const alligator=rows.map((_,i)=>({jaw:i<13?null:mean(typical.slice(i-13,i+1)),teeth:i<8?null:mean(typical.slice(i-8,i+1)),lips:i<5?null:mean(typical.slice(i-5,i+1))}));
 const mom=c.map((x,i)=>i<14?null:x-c[i-14]),roc=c.map((x,i)=>i<14?null:(x/c[i-14]-1)*100);
 const dema=ema20.map((x,i)=>x===null?null:2*x-(ema(ema20.map(z=>z||0),20)[i]||0));
 const output={
 "Moving Average":sma20.at(-1),"Exponential Moving Average":ema20.at(-1),"Smoothed Moving Average":smma(c,20).at(-1),"Linear Weighted Moving Average":wma(c,20).at(-1),
 "Bollinger Bands":upper.at(-1)===null?null:{upper:upper.at(-1),middle:middle.at(-1),lower:lower.at(-1)},
 "Envelopes":envelopes.at(-1),"Ichimoku Kinko Hyo":ichi.at(-1),"Parabolic SAR":sar.at(-1),"Standard Deviation":upper.at(-1)===null?null:(upper.at(-1)-middle.at(-1))/2,
 "Average Directional Movement Index":adx.at(-1),"Average True Range":atr14.at(-1),
 "Bears Power":ema20.at(-1)===null?null:l.at(-1)-ema20.at(-1),"Bulls Power":ema20.at(-1)===null?null:h.at(-1)-ema20.at(-1),
 "Commodity Channel Index":cci.at(-1),"DeMarker":dem.at(-1),"Force Index":force.at(-1),
 "MACD":macd.at(-1)===null?null:{main:macd.at(-1),signal:signal.at(-1)},
 "Momentum":mom.at(-1),"Moving Average of Oscillator":sma5.at(-1)===null||sma34.at(-1)===null?null:sma5.at(-1)-sma34.at(-1),
 "Relative Strength Index":rsi.at(-1),"Relative Vigor Index":rvi.at(-1),
 "Stochastic Oscillator":stoch.at(-1),"Williams Percent Range":high14.at(-1)===null?null:high14.at(-1)===low14.at(-1)?0:-100*(high14.at(-1)-c.at(-1))/(high14.at(-1)-low14.at(-1)),
 "Accumulation/Distribution":ad.at(-1),"Money Flow Index":mfi.at(-1),"On Balance Volume":obv.at(-1),"Volumes":v.at(-1),
 "Alligator":alligator.at(-1),"Awesome Oscillator":ao.at(-1),"Accelerator Oscillator":ac.at(-1)
 };
 return output;
}
root.HikeyFXIndicators={names,calculate};
})(window);
