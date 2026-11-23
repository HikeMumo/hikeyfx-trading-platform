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
const smaValid=(a,p)=>a.map((_,i)=>i+1<p||a.slice(i-p+1,i+1).some(x=>!Number.isFinite(x))?null:mean(a.slice(i-p+1,i+1)));
const ema=(a,p)=>{const out=[];let v=null,k=2/(p+1),seed=[];a.forEach((x)=>{if(!Number.isFinite(x)){out.push(null);return}if(v===null){seed.push(x);if(seed.length===p){v=mean(seed);out.push(v)}else out.push(null)}else{v=x*k+v*(1-k);out.push(v)}});return out};
const smma=(a,p)=>{const out=[];let v=null;a.forEach((x,i)=>{v=i===p-1?mean(a.slice(0,p)):i>=p?((v*(p-1)+x)/p):null;out.push(v)});return out};
const smmaValid=(a,p)=>{const out=Array(a.length).fill(null),seed=[];let v=null;a.forEach((x,i)=>{if(!Number.isFinite(x))return;if(v===null){seed.push(x);if(seed.length===p){v=mean(seed);out[i]=v}}else{v=(v*(p-1)+x)/p;out[i]=v}});return out};
const wma=(a,p)=>a.map((_,i)=>{if(i+1<p)return null;let n=0,d=0;for(let j=0;j<p;j++){n+=a[i-p+1+j]*(j+1);d+=j+1}return n/d});
const std=(a)=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
function calculate(rows){
 if(!Array.isArray(rows)||rows.length<2)return {};
 const c=rows.map(x=>Number(x.close)),h=rows.map(x=>Number(x.high)),l=rows.map(x=>Number(x.low)),o=rows.map(x=>Number(x.open)),v=rows.map(x=>Number(x.volume||0)),n=c.length,hasVolume=rows.some(x=>Number.isFinite(Number(x.volume))&&Number(x.volume)>0);
 if(rows.some((x,i)=>![c[i],h[i],l[i],o[i]].every(Number.isFinite)))return {};
 const sma20=sma(c,20),sma14=sma(c,14),ema12=ema(c,12),ema13=ema(c,13),ema26=ema(c,26),ema20=ema(c,20),sma5=sma(c,5),sma34=sma(c,34);
 const tr=rows.map((x,i)=>i===0?h[i]-l[i]:Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));
 const atr14=smma(tr,14);
 const gain=[],loss=[];for(let i=0;i<n;i++){if(i===0){gain.push(null);loss.push(null);continue}const d=c[i]-c[i-1];gain.push(Math.max(0,d));loss.push(Math.max(0,-d))}
 const avgGain=smmaValid(gain,14),avgLoss=smmaValid(loss,14);
 const rsi=c.map((_,i)=>avgGain[i]===null?null:avgLoss[i]===0?(avgGain[i]===0?50:100):100-100/(1+avgGain[i]/avgLoss[i]));
 const upper=[],lower=[],middle=[];for(let i=0;i<n;i++){if(i<19){upper.push(null);lower.push(null);middle.push(null)}else{const a=c.slice(i-19,i+1),m=mean(a),s=std(a);middle.push(m);upper.push(m+2*s);lower.push(m-2*s)}}
 const high14=[],low14=[];for(let i=0;i<n;i++){high14.push(i<13?null:Math.max(...h.slice(i-13,i+1)));low14.push(i<13?null:Math.min(...l.slice(i-13,i+1)))}
 const typical=rows.map((_,i)=>(h[i]+l[i]+c[i])/3),median=rows.map((_,i)=>(h[i]+l[i])/2);
 const cci=typical.map((x,i)=>{if(i<19)return null;const a=typical.slice(i-19,i+1),m=mean(a),dev=mean(a.map(z=>Math.abs(z-m)));return dev? (x-m)/(.015*dev):0});
 const demUp=[],demDown=[];for(let i=0;i<n;i++){demUp.push(i?Math.max(h[i]-h[i-1],0):0);demDown.push(i?Math.max(l[i-1]-l[i],0):0)}
 const dem=demUp.map((_,i)=>{if(i<13)return null;const u=mean(demUp.slice(i-13,i+1)),d=mean(demDown.slice(i-13,i+1));return u+d?u/(u+d):0});
 const forceRaw=c.map((x,i)=>hasVolume&&i? (x-c[i-1])*v[i]:null),force=hasVolume?smaValid(forceRaw,13):Array(n).fill(null);
 const moneyFlow=typical.map((x,i)=>x*v[i]);
 const positiveFlow=moneyFlow.map((x,i)=>i&&typical[i]>typical[i-1]?x:0),negativeFlow=moneyFlow.map((x,i)=>i&&typical[i]<typical[i-1]?x:0);
 const mfi=moneyFlow.map((_,i)=>{if(!hasVolume||i<13)return null;const p=positiveFlow.slice(i-13,i+1).reduce((a,b)=>a+b,0),q=negativeFlow.slice(i-13,i+1).reduce((a,b)=>a+b,0);return q===0?100:100-100/(1+p/q)});
 const obv=[];for(let i=0;i<n;i++)obv.push(!hasVolume?null:i?obv[i-1]+(c[i]>c[i-1]?v[i]:c[i]<c[i-1]?-v[i]:0):v[i]);
 const ad=[];for(let i=0;i<n;i++){if(!hasVolume){ad.push(null);continue}const m=h[i]===l[i]?0:((c[i]-l[i])-(h[i]-c[i]))/(h[i]-l[i]);ad.push((i?ad[i-1]:0)+m*v[i])}
 const ao=c.map((_,i)=>i<33?null:mean(median.slice(i-4,i+1))-mean(median.slice(i-33,i+1)));
 const ac=ao.map((x,i)=>x===null||i<4?null:x-mean(ao.slice(i-4,i+1)));
 const macd=ema12.map((x,i)=>x===null||ema26[i]===null?null:x-ema26[i]);
 const signal=ema(macd,9);
 const plusDM=[],minusDM=[];for(let i=0;i<n;i++){const up=i?h[i]-h[i-1]:0,down=i?l[i-1]-l[i]:0;plusDM.push(up>down&&up>0?up:0);minusDM.push(down>up&&down>0?down:0)}
 const plusSmoothed=smma(plusDM,14),minusSmoothed=smma(minusDM,14);
 const dx=rows.map((_,i)=>{if(plusSmoothed[i]===null||minusSmoothed[i]===null||!atr14[i])return null;const plus=100*plusSmoothed[i]/atr14[i],minus=100*minusSmoothed[i]/atr14[i];return plus+minus?100*Math.abs(plus-minus)/(plus+minus):0});
 const adx=[];let adxPrevious=null;for(let i=0;i<n;i++){if(i<26){adx.push(null);continue}if(i===26)adxPrevious=mean(dx.slice(13,27));else adxPrevious=(adxPrevious*13+dx[i])/14;adx.push(adxPrevious)}
 const stochRaw=rows.map((_,i)=>{if(i<4)return null;const hh=Math.max(...h.slice(i-4,i+1)),ll=Math.min(...l.slice(i-4,i+1));return hh===ll?50:100*(c[i]-ll)/(hh-ll)});const stoch=smaValid(stochRaw,3),stochD=smaValid(stoch,3);
 const rviNumerator=rows.map((_,i)=>i<3?null:((c[i]-o[i])+2*(c[i-1]-o[i-1])+2*(c[i-2]-o[i-2])+(c[i-3]-o[i-3]))/6),rviDenominator=rows.map((_,i)=>i<3?null:((h[i]-l[i])+2*(h[i-1]-l[i-1])+2*(h[i-2]-l[i-2])+(h[i-3]-l[i-3]))/6);const rvi=rows.map((_,i)=>{if(i<12)return null;const num=rviNumerator.slice(i-9,i+1).reduce((a,b)=>a+b,0),den=rviDenominator.slice(i-9,i+1).reduce((a,b)=>a+b,0);return den?num/den:0});const rviSignal=rvi.map((_,i)=>i<15||rvi.slice(i-3,i+1).some(x=>!Number.isFinite(x))?null:(rvi[i]+2*rvi[i-1]+2*rvi[i-2]+rvi[i-3])/6);
 const sar=[];let rising=true,ep=h[0],s=l[0],af=.02;for(let i=0;i<n;i++){if(i>0){s=s+af*(ep-s);if(rising){s=Math.min(s,l[i-1],i>1?l[i-2]:l[i-1]);if(l[i]<s){rising=false;s=ep;ep=l[i];af=.02}else if(h[i]>ep){ep=h[i];af=Math.min(.2,af+.02)}}else{s=Math.max(s,h[i-1],i>1?h[i-2]:h[i-1]);if(h[i]>s){rising=true;s=ep;ep=h[i];af=.02}else if(l[i]<ep){ep=l[i];af=Math.min(.2,af+.02)}}}sar.push(s)}
 const tenkan=rows.map((_,i)=>i<8?null:(Math.max(...h.slice(i-8,i+1))+Math.min(...l.slice(i-8,i+1)))/2);
 const kijun=rows.map((_,i)=>i<25?null:(Math.max(...h.slice(i-25,i+1))+Math.min(...l.slice(i-25,i+1)))/2);
 const spanA=tenkan.map((x,i)=>x===null||kijun[i]===null?null:(x+kijun[i])/2);
 const spanB=rows.map((_,i)=>i<51?null:(Math.max(...h.slice(i-51,i+1))+Math.min(...l.slice(i-51,i+1)))/2);
 const projectedA=shiftSeries(spanA,26),projectedB=shiftSeries(spanB,26),chikou=Array(n).fill(null);for(let i=26;i<n;i++)chikou[i-26]=c[i];
 const ichi=rows.map((_,i)=>({tenkan:tenkan[i],kijun:kijun[i],senkouA:projectedA[i],senkouB:projectedB[i],chikou:chikou[i]}));
 const envelopes=sma14.map(x=>x===null?null:{upper:x*1.001,lower:x*.999});
 function shiftSeries(values,shift){const out=Array(values.length).fill(null);values.forEach(function(value,i){if(i+shift<out.length)out[i+shift]=value});return out}
 const jaw=shiftSeries(smma(median,13),8),teeth=shiftSeries(smma(median,8),5),lips=shiftSeries(smma(median,5),3);
 const alligator=rows.map((_,i)=>({jaw:jaw[i],teeth:teeth[i],lips:lips[i]}));
 const mom=c.map((x,i)=>i<14?null:(c[i-14]===0?null:x/c[i-14]*100)),roc=c.map((x,i)=>i<14?null:(x/c[i-14]-1)*100);
 const dema=ema20.map((x,i)=>x===null?null:2*x-(ema(ema20.map(z=>z||0),20)[i]||0));
 const smma20=smma(c,20),wma20=wma(c,20),maOsc=macd.map((x,i)=>x===null||signal[i]===null?null:x-signal[i]);
 const std20=upper.map((x,i)=>x===null?null:(x-middle[i])/2);
 const output={
 "Moving Average":sma20.at(-1),"Exponential Moving Average":ema20.at(-1),"Smoothed Moving Average":smma20.at(-1),"Linear Weighted Moving Average":wma20.at(-1),
 "Bollinger Bands":upper.at(-1)===null?null:{upper:upper.at(-1),middle:middle.at(-1),lower:lower.at(-1)},
 "Envelopes":envelopes.at(-1),"Ichimoku Kinko Hyo":ichi.at(-1),"Parabolic SAR":sar.at(-1),"Standard Deviation":std20.at(-1),
 "Average Directional Movement Index":adx.at(-1),"Average True Range":atr14.at(-1),
 "Bears Power":ema13.at(-1)===null?null:l.at(-1)-ema13.at(-1),"Bulls Power":ema13.at(-1)===null?null:h.at(-1)-ema13.at(-1),
 "Commodity Channel Index":cci.at(-1),"DeMarker":dem.at(-1),"Force Index":force.at(-1),
 "MACD":macd.at(-1)===null?null:{main:macd.at(-1),signal:signal.at(-1)},
 "Momentum":mom.at(-1),"Moving Average of Oscillator":maOsc.at(-1),
 "Relative Strength Index":rsi.at(-1),"Relative Vigor Index":rvi.at(-1)===null?null:{main:rvi.at(-1),signal:rviSignal.at(-1)},
 "Stochastic Oscillator":stoch.at(-1)===null?null:{main:stoch.at(-1),signal:stochD.at(-1)},"Williams Percent Range":high14.at(-1)===null?null:high14.at(-1)===low14.at(-1)?0:-100*(high14.at(-1)-c.at(-1))/(high14.at(-1)-low14.at(-1)),
 "Accumulation/Distribution":ad.at(-1),"Money Flow Index":mfi.at(-1),"On Balance Volume":obv.at(-1),"Volumes":hasVolume?v.at(-1):null,
 "Alligator":alligator.at(-1),"Awesome Oscillator":ao.at(-1),"Accelerator Oscillator":ac.at(-1)
 };
 const series={
 "Moving Average":sma20,"Exponential Moving Average":ema20,"Smoothed Moving Average":smma20,"Linear Weighted Moving Average":wma20,
 "Bollinger Bands":{upper:upper,middle:middle,lower:lower},"Envelopes":{upper:envelopes.map(x=>x&&x.upper),middle:sma14,lower:envelopes.map(x=>x&&x.lower)},
 "Ichimoku Kinko Hyo":{tenkan:ichi.map(x=>x.tenkan),kijun:ichi.map(x=>x.kijun),senkouA:ichi.map(x=>x.senkouA),senkouB:ichi.map(x=>x.senkouB),chikou:ichi.map(x=>x.chikou)},
 "Parabolic SAR":sar,"Standard Deviation":std20,"Average Directional Movement Index":adx,"Average True Range":atr14,
 "Bears Power":c.map((x,i)=>ema13[i]===null?null:l[i]-ema13[i]),"Bulls Power":c.map((x,i)=>ema13[i]===null?null:h[i]-ema13[i]),
 "Commodity Channel Index":cci,"DeMarker":dem,"Force Index":force,"MACD":{main:macd,signal:signal},
 "Momentum":mom,"Moving Average of Oscillator":maOsc,"Relative Strength Index":rsi,"Relative Vigor Index":{main:rvi,signal:rviSignal},
 "Stochastic Oscillator":{main:stoch,signal:stochD},"Williams Percent Range":high14.map((x,i)=>x===null?null:x===low14[i]?0:-100*(x-c[i])/(x-low14[i])),
 "Accumulation/Distribution":ad,"Money Flow Index":mfi,"On Balance Volume":obv,"Volumes":hasVolume?v:Array(n).fill(null),
 "Alligator":{jaw:jaw,teeth:teeth,lips:lips},
 "Awesome Oscillator":ao,"Accelerator Oscillator":ac
 };
 Object.defineProperty(output,"series",{value:series,enumerable:false});
 return output;
}
root.HikeyFXIndicators={names,calculate};
})(window);
