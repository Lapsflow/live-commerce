// ════════════════════════════════════════════════════════════
// 공식 라이브 운영관리 시스템 v3.4 - 성능 최적화판
// ★ 기존 코드 100% 유지 + 캐시 조회 패치만 적용
// ════════════════════════════════════════════════════════════

function fixAdminNames(){
  try{
    var ss=getSS(),ws=ss.getSheetByName('MEMBER');
    if(!ws)return{ok:false};
    var d=ws.getDataRange().getValues(),idToName={},fixed=0;
    for(var i=1;i<d.length;i++){
      var id=String(d[i][0]||'').trim(),nm=String(d[i][2]||'').trim(),rl=String(d[i][5]||'').trim();
      if(rl==='관리자'||rl==='마스터'||rl==='부마스터')idToName[id]=nm;
    }
    for(var i=1;i<d.length;i++){
      var ref=String(d[i][10]||'').trim();
      if(ref&&idToName[ref]){ws.getRange(i+1,11).setValue(idToName[ref]);fixed++;}
    }
    return{ok:true,fixed:fixed};
  }catch(e){return{ok:false,msg:e.message}}
}

function doGet(e){
  var page=(e&&e.parameter&&e.parameter.page)||'main';
  if(page==='proposal'){
    return HtmlService.createHtmlOutput(
      Utilities.newBlob(Utilities.base64Decode(PROPOSAL_HTML)).getDataAsString()
    ).setTitle('라이브 운영관리 - 제안서').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var html=Utilities.newBlob(Utilities.base64Decode(MAIN_HTML)).getDataAsString();
  html=html.replace('</body>',buildJsPatch()+'</body>');
  return HtmlService.createHtmlOutput(html)
    .setTitle('공식 라이브 운영관리 시스템')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function buildJsPatch(){
  var j='<script>\n';
  j+='setInterval(function(){\n';
  j+='  var el=document.getElementById("cacheStatus");\n';
  j+='  if(!el)return;\n';
  j+='  var t=el.textContent||"";\n';
  j+='  if(t.indexOf("종")>-1&&t.indexOf("준비완료")>-1){\n';
  j+='    el.textContent="준비완료";\n';
  j+='    el.style.color="#4ade80";\n';
  j+='  }\n';
  j+='},300);\n';
  j+='function downloadOrderTemplate(){\n';
  j+='  var t=new Date(),y=t.getFullYear(),m=t.getMonth()+1,d=t.getDate();\n';
  j+='  var ds=y+"-"+(m<10?"0"+m:""+m)+"-"+(d<10?"0"+d:""+d);\n';
  j+='  var n=currentUser?currentUser.name:"셀러";\n';
  j+='  var cols=["주문번호","수령자","연락처","주소","날짜","상품명","옵션","수량","배송메시지","입금액","공급가(개당)","공급가(합계)","마진","바코드","주문시간"];\n';
  j+='  var row=["","","","",ds,"예시 상품명","",1,"",29900,12000,12000,17900,"8801234567890",""];\n';
  j+='  var ws=XLSX.utils.aoa_to_sheet([cols,row]);\n';
  j+='  ws["!cols"]=[{wch:13},{wch:10},{wch:14},{wch:25},{wch:12},{wch:22},{wch:12},{wch:5},{wch:20},{wch:10},{wch:10},{wch:10},{wch:10},{wch:16},{wch:16}];\n';
  j+='  var wb=XLSX.utils.book_new();\n';
  j+='  XLSX.utils.book_append_sheet(wb,ws,"발주서");\n';
  j+='  XLSX.writeFile(wb,n+"_"+ds+".xlsx");\n';
  j+='  if(typeof showToast==="function")showToast("발주서 양식 다운로드 완료","success");\n';
  j+='}\n';
  j+='function downloadOrderPad(){\n';
  j+='  if(!orderPadItems||!orderPadItems.length){\n';
  j+='    if(typeof showToast==="function")showToast("주문 목록이 없습니다","info");\n';
  j+='    return;\n';
  j+='  }\n';
  j+='  var t=new Date(),y=t.getFullYear(),m=t.getMonth()+1,d=t.getDate();\n';
  j+='  var ds=y+"-"+(m<10?"0"+m:""+m)+"-"+(d<10?"0"+d:""+d);\n';
  j+='  var cols=["주문번호","수령자","연락처","주소","날짜","상품명","옵션","수량","배송메시지","입금액","공급가(개당)","공급가(합계)","마진","바코드","주문시간"];\n';
  j+='  var rows=[cols];\n';
  j+='  orderPadItems.forEach(function(o){\n';
  j+='    var st=(o.supplyPrice||0)*o.qty,mg=o.amount-st;\n';
  j+='    rows.push(["",o.buyer||"","","",ds,o.productName||"",o.option||"",o.qty,"",o.amount||0,o.supplyPrice||0,st,mg,o.barcode||"",o.time||""]);\n';
  j+='  });\n';
  j+='  var ws=XLSX.utils.aoa_to_sheet(rows);\n';
  j+='  ws["!cols"]=[{wch:13},{wch:10},{wch:14},{wch:25},{wch:12},{wch:22},{wch:12},{wch:5},{wch:20},{wch:10},{wch:10},{wch:10},{wch:10},{wch:16},{wch:16}];\n';
  j+='  var wb=XLSX.utils.book_new();\n';
  j+='  XLSX.utils.book_append_sheet(wb,ws,"발주서");\n';
  j+='  var n=currentUser?currentUser.name:"셀러";\n';
  j+='  XLSX.writeFile(wb,n+"_"+ds+".xlsx");\n';
  j+='}\n';
  j+='function bulkStatusChange(date,field,value){\n';
j+='  if(!value)return;\n';
j+='  showLoading();\n';
j+='  google.script.run.withSuccessHandler(function(r){hideLoading();\n';
j+='    if(r.ok){\n';
j+='      showToast("변경 완료 ("+r.count+"건)","success");\n';
j+='      setTimeout(function(){loadRecentOrders();},1500);\n';
j+='    }else{\n';
j+='      showToast(r.msg||"변경 실패","error");\n';
j+='    }\n';
j+='  }).withFailureHandler(function(e){hideLoading();showToast("오류: "+e.message,"error");})\n';
j+='  .bulkUpdateOrderStatus(date,field,value);\n';
j+='}\n';
j+='function changeSingleStatus(row,field,value){\n';
j+='  showLoading();\n';
j+='  google.script.run.withSuccessHandler(function(r){hideLoading();\n';
j+='    if(r.ok){loadRecentOrders();}else showToast("처리 실패","info");\n';
j+='  }).updateSingleOrderStatus(row,field,value);\n';
j+='}\n';
j+='function loadRecentOrders(){\n';
j+='  showLoading();\n';
j+='  google.script.run.withSuccessHandler(function(r){hideLoading();\n';
j+='    var el=document.getElementById("recentOrders");\n';
j+='    if(!r||!r.length){el.innerHTML="<div class=\'muted\' style=\'text-align:center;padding:12px\'>발주 내역이 없습니다</div>";return;}\n';
j+='    var isAdmin=currentUser&&(currentUser.role==="관리자"||currentUser.role==="마스터"||currentUser.role==="부마스터");\n';
j+='    var h="";\n';
j+='    r.slice(0,20).forEach(function(o){\n';
j+='      var payBg=o.payStatus==="입금완료"?"#d1fae5":"#fef2f2";\n';
j+='      var payColor=o.payStatus==="입금완료"?"#065f46":"#dc2626";\n';
j+='      var shipBg=o.mainStatus==="출고완료"?"#d1fae5":o.mainStatus==="발송준비"?"#dbeafe":"#f1f5f9";\n';
j+='      var shipColor=o.mainStatus==="출고완료"?"#065f46":o.mainStatus==="발송준비"?"#1e40af":"#64748b";\n';
j+='      var profitRate=o.amount>0?Math.round(o.margin/o.amount*100):0;\n';
j+='      h+="<div style=\'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px\'>";\n';
j+='      h+="<div style=\'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px\'>";\n';
j+='      h+="<div style=\'display:flex;align-items:center;gap:8px;flex-wrap:wrap\'>";\n';
j+='      var days=["일","월","화","수","목","금","토"];\n';
j+='      var dateKor=o.date||"";\n';
j+='      try{\n';
j+='        var dd=new Date(o.date);\n';
j+='        if(!isNaN(dd.getTime())){\n';
j+='          dateKor=(dd.getMonth()+1)+"월 "+dd.getDate()+"일 ("+days[dd.getDay()]+")";\n';
j+='        }\n';
j+='      }catch(ex){dateKor=o.date||"";}\n';
j+='      var payBadgeBg=o.payStatus==="입금완료"?"#d1fae5":"#fef2f2";\n';
j+='      var payBadgeColor=o.payStatus==="입금완료"?"#065f46":"#dc2626";\n';
j+='      h+="<span style=\'font-weight:700;font-size:15px\'>📅 "+dateKor+"</span>";\n';
j+='      if(o.seller)h+="<span style=\'font-size:12px;padding:3px 10px;border-radius:20px;background:#dbeafe;color:#1e40af;font-weight:700\'>👤 "+o.seller+"</span>";\n';
j+='      h+="<span style=\'font-size:12px;padding:4px 12px;border-radius:20px;background:"+payBadgeBg+";color:"+payBadgeColor+";font-weight:700\'>💰 "+(o.payStatus||"입금확인전")+"</span>";\n';
j+='      h+="<span style=\'font-size:12px;padding:4px 12px;border-radius:20px;background:"+shipBg+";color:"+shipColor+";font-weight:700\'>🚚 "+(o.mainStatus||"대기")+"</span>";\n';
j+='      if(isAdmin)h+="<button onclick=\'deleteOrderBatchConfirm(\\\""+o.date+"\\\",\\\""+o.seller+"\\\")\' style=\'background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;color:#dc2626;cursor:pointer;font-size:10px;padding:2px 6px\'>삭제</button>";\n';
j+='      h+="</div></div>";\n';
j+='      h+="<div style=\'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px\'>";\n';
j+='      h+="<div style=\'background:#f0fdf4;border-radius:8px;padding:10px;text-align:center\'><div style=\'font-size:9px;color:#888;margin-bottom:2px\'>매출</div><div style=\'font-size:16px;font-weight:800;color:#0F6E56\'>₩"+fmt(o.amount)+"</div></div>";\n';
j+='      h+="<div style=\'background:#faf5ff;border-radius:8px;padding:10px;text-align:center\'><div style=\'font-size:9px;color:#888;margin-bottom:2px\'>공급가</div><div style=\'font-size:16px;font-weight:800;color:#7c3aed\'>₩"+fmt(o.supplyCost)+"</div></div>";\n';
j+='      h+="<div style=\'background:#fefce8;border-radius:8px;padding:10px;text-align:center\'><div style=\'font-size:9px;color:#888;margin-bottom:2px\'>수익("+profitRate+"%)</div><div style=\'font-size:16px;font-weight:800;color:#f59e0b\'>₩"+fmt(o.margin)+"</div></div>";\n';
j+='      h+="</div>";\n';
j+='      h+="<div style=\'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px\'>";\n';
j+='      h+="<div style=\'background:#f1f5f9;border-radius:8px;padding:8px;text-align:center\'><div style=\'font-size:9px;color:#888\'>구매사</div><div style=\'font-size:14px;font-weight:700;color:#3b82f6\'>"+(o.buyerCount||0)+"명</div></div>";\n';
j+='      h+="<div style=\'background:#f1f5f9;border-radius:8px;padding:8px;text-align:center\'><div style=\'font-size:9px;color:#888\'>발주</div><div style=\'font-size:14px;font-weight:700;color:#334155\'>"+(o.count||0)+"건 ("+(o.totalQty||0)+"개)</div></div>";\n';
j+='      h+="<div style=\'background:#f1f5f9;border-radius:8px;padding:8px;text-align:center\'><div style=\'font-size:9px;color:#888\'>수익률</div><div style=\'font-size:14px;font-weight:700;color:"+(profitRate>=30?"#0F6E56":profitRate>=15?"#f59e0b":"#dc2626")+"\'>"+profitRate+"%</div></div>";\n';
j+='      h+="</div>";\n';
j+='      if(isAdmin){\n';
j+='        h+="<div style=\'margin-top:8px;display:flex;gap:6px\'>";\n';
j+='        h+="<button onclick=\'expandOrders(\\\""+o.date+"\\\",this)\' style=\'flex:1;padding:6px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;cursor:pointer;color:#334155\'>📋 상세보기</button>";\n';
j+='        h+="<select onchange=\'bulkStatusChange(\\\""+o.date+"\\\",\\\"pay\\\",this.value)\' style=\'flex:1;padding:6px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;font-family:inherit;background:#fff\'><option value=\'\'>입금상태 일괄변경</option><option value=\'입금확인전\'>입금확인전</option><option value=\'입금완료\'>입금완료</option></select>";\n';
j+='        h+="<select onchange=\'bulkStatusChange(\\\""+o.date+"\\\",\\\"ship\\\",this.value)\' style=\'flex:1;padding:6px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;font-family:inherit;background:#fff\'><option value=\'\'>출고상태 일괄변경</option><option value=\'대기\'>대기</option><option value=\'발송준비\'>발송준비</option><option value=\'출고완료\'>출고완료</option><option value=\'부분출고\'>부분출고</option></select>";\n';
j+='        h+="</div>";\n';
j+='      }\n';
j+='      h+="<div id=\'orderDetail_"+o.date.replace(/-/g,"")+"\' style=\'display:none;margin-top:8px\'></div>";\n';
j+='      h+="</div>";\n';
j+='    });\n';
j+='    el.innerHTML=h;\n';
j+='  }).withFailureHandler(function(){hideLoading()}).getRecentOrderBatches(currentUser.role,currentUser.name);\n';
j+='}\n';
j+='</script>';
  return j;
}

// ★★★ 아래 MAIN_HTML 값을 기존 코드의 값으로 교체하세요 ★★★
var MAIN_HTML='PCFET0NUWVBFIGh0bWw+CjxodG1sPgo8aGVhZD4KPG1ldGEgY2hhcnNldD0idXRmLTgiPgo8bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLGluaXRpYWwtc2NhbGU9MSI+CjxzdHlsZT4KKnttYXJnaW46MDtwYWRkaW5nOjA7Ym94LXNpemluZzpib3JkZXItYm94fQpib2R5e2ZvbnQtZmFtaWx5OidHb29nbGUgU2FucycsUm9ib3RvLFByZXRlbmRhcmQsc2Fucy1zZXJpZjtmb250LXNpemU6MTNweDtjb2xvcjojMzMzO2JhY2tncm91bmQ6I2ZmZn0KLnRvcHtiYWNrZ3JvdW5kOiMxYTFhMmU7Y29sb3I6I2ZmZjtwYWRkaW5nOjEycHggMTZweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyfQoubG9nb3tmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjE1cHh9LmxvZ28gc3Bhbntjb2xvcjojNGFkZTgwfQouYXZhdGFye3dpZHRoOjI4cHg7aGVpZ2h0OjI4cHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDojNGFkZTgwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7Y29sb3I6IzFhMWEyZX0KLnVzZXJ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NnB4fQoudGFic3tkaXNwbGF5OmZsZXg7YmFja2dyb3VuZDojMGYxNzJhO3BhZGRpbmc6OHB4IDEycHg7Z2FwOjZweDtvdmVyZmxvdy14OmF1dG87LXdlYmtpdC1vdmVyZmxvdy1zY3JvbGxpbmc6dG91Y2h9Ci50YWJ7ZmxleDpub25lO3BhZGRpbmc6OHB4IDE4cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjEycHg7Y29sb3I6Izk0YTNiODtiYWNrZ3JvdW5kOiMxZTI5M2I7Ym9yZGVyOjFweCBzb2xpZCAjMzM0MTU1O2JvcmRlci1yYWRpdXM6OHB4O2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQ7Zm9udC13ZWlnaHQ6NTAwO3RyYW5zaXRpb246YWxsIC4yczt3aGl0ZS1zcGFjZTpub3dyYXB9Ci50YWI6aG92ZXJ7YmFja2dyb3VuZDojMzM0MTU1O2NvbG9yOiNlMmU4ZjB9Ci50YWIuYWN0aXZle2NvbG9yOiNmZmY7YmFja2dyb3VuZDojNGFkZTgwO2JvcmRlci1jb2xvcjojNGFkZTgwO2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMGYxNzJhO2JveC1zaGFkb3c6MCAycHggOHB4IHJnYmEoNzQsMjIyLDEyOCwuMyl9Ci5jb250ZW50e3BhZGRpbmc6MH0uY29udGVudD5kaXY6bm90KCN0YWItc2Nhbil7cGFkZGluZzoxMnB4fQouY2FyZHtiYWNrZ3JvdW5kOiNmYWZhZmE7Ym9yZGVyOjFweCBzb2xpZCAjZWVlO2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjE0cHg7bWFyZ2luLWJvdHRvbToxMHB4fQouY2FyZC10aXRsZXtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo2MDA7bWFyZ2luLWJvdHRvbToxMHB4fQoubGFiZWx7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NTAwO21hcmdpbi1ib3R0b206NHB4O2NvbG9yOiMzMzN9Ci5pbnB1dHt3aWR0aDoxMDAlO3BhZGRpbmc6OXB4IDEwcHg7Ym9yZGVyOjFweCBzb2xpZCAjZGRkO2JvcmRlci1yYWRpdXM6N3B4O2ZvbnQtc2l6ZToxM3B4O21hcmdpbi1ib3R0b206MTBweDtvdXRsaW5lOm5vbmU7Zm9udC1mYW1pbHk6aW5oZXJpdH0KLmlucHV0OmZvY3Vze2JvcmRlci1jb2xvcjojNGFkZTgwfQpzZWxlY3QuaW5wdXR7YXBwZWFyYW5jZTphdXRvfQoucGxhdGZvcm1ze2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmciAxZnI7Z2FwOjZweDttYXJnaW4tYm90dG9tOjEycHh9Ci5wbGF0e3BhZGRpbmc6MTBweCA2cHg7Ym9yZGVyLXJhZGl1czo4cHg7Ym9yZGVyOjFweCBzb2xpZCAjZGRkO3RleHQtYWxpZ246Y2VudGVyO2N1cnNvcjpwb2ludGVyO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjUwMDt0cmFuc2l0aW9uOmFsbCAuMTVzO2JhY2tncm91bmQ6I2ZmZn0KLnBsYXQuc2Vse2JvcmRlci13aWR0aDoycHh9Ci5idG57d2lkdGg6MTAwJTtwYWRkaW5nOjEycHg7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czo4cHg7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NjAwO2N1cnNvcjpwb2ludGVyO2NvbG9yOiNmZmY7Zm9udC1mYW1pbHk6aW5oZXJpdH0KLmJ0bi1yZWR7YmFja2dyb3VuZDojZGMyNjI2fS5idG4tcmVkOmRpc2FibGVke2JhY2tncm91bmQ6I2NjYztjdXJzb3I6ZGVmYXVsdH0KLmJ0bi1ncmVlbntiYWNrZ3JvdW5kOiMwRjZFNTZ9Ci5idG4tYmx1ZXtiYWNrZ3JvdW5kOiMzYjgyZjZ9Ci5tdXRlZHtmb250LXNpemU6MTFweDtjb2xvcjojODg4O21hcmdpbi10b3A6NHB4fQoubGl2ZS1iYXJ7YmFja2dyb3VuZDojZGMyNjI2O2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjEycHggMTRweDttYXJnaW4tYm90dG9tOjEwcHg7Y29sb3I6I2ZmZn0KLmxpdmUtZG90e3dpZHRoOjhweDtoZWlnaHQ6OHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6I2ZmZjtkaXNwbGF5OmlubGluZS1ibG9jazttYXJnaW4tcmlnaHQ6NnB4O2FuaW1hdGlvbjpwdWxzZSAxLjVzIGluZmluaXRlfQpAa2V5ZnJhbWVzIHB1bHNlezAlLDEwMCV7b3BhY2l0eToxfTUwJXtvcGFjaXR5Oi4zfX0KLnN0YXQtZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyO2dhcDo2cHg7bWFyZ2luLWJvdHRvbToxMHB4fQouc3RhdHt0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjEwcHggNnB4O2JhY2tncm91bmQ6I2YwZjBmMDtib3JkZXItcmFkaXVzOjdweH0KLnN0YXQtbnVte2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjcwMH0uc3RhdC1sYWJlbHtmb250LXNpemU6MTBweDtjb2xvcjojODg4O21hcmdpbi10b3A6MnB4fQouaGlzdG9yeS1yb3d7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcjtwYWRkaW5nOjhweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNlZWV9Ci5oaXN0b3J5LXJvdzpsYXN0LWNoaWxke2JvcmRlci1ib3R0b206bm9uZX0KLnByb2R1Y3Qtcm93e2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpjZW50ZXI7cGFkZGluZzo4cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjZjBmMGYwfQoucHJvZHVjdC1yb3c6bGFzdC1jaGlsZHtib3JkZXI6bm9uZX0KLnRhZ3tkaXNwbGF5OmlubGluZS1ibG9jaztwYWRkaW5nOjFweCA3cHg7Ym9yZGVyLXJhZGl1czoxMHB4O2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjUwMH0KLmhpZGRlbntkaXNwbGF5Om5vbmV9Ci5zY2FuLXJlc3VsdHtiYWNrZ3JvdW5kOiNmMGZkZjQ7Ym9yZGVyOjFweCBzb2xpZCAjODZlZmFjO2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjE0cHg7bWFyZ2luLWJvdHRvbToxMHB4fQouc2Nhbi1yZXN1bHQgaDN7Zm9udC1zaXplOjE1cHg7Zm9udC13ZWlnaHQ6NjAwO2NvbG9yOiMxNjY1MzQ7bWFyZ2luLWJvdHRvbTo4cHh9Ci5zY2FuLWluZm97ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6NHB4IDA7Zm9udC1zaXplOjEycHh9Ci5zY2FuLWluZm8gc3BhbjpmaXJzdC1jaGlsZHtjb2xvcjojODg4fQouc2Nhbi1pbmZvIHNwYW46bGFzdC1jaGlsZHtmb250LXdlaWdodDo1MDB9Ci5zdG9jay1kZXRhaWx7bWFyZ2luLXRvcDo4cHg7cGFkZGluZy10b3A6OHB4O2JvcmRlci10b3A6MXB4IHNvbGlkICNiYmY3ZDB9Ci5zdG9jay1yb3d7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO3BhZGRpbmc6M3B4IDA7Zm9udC1zaXplOjEycHh9Ci5zdG9jay10b3RhbHtmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjE0cHg7Y29sb3I6IzE2NjUzNDtib3JkZXItdG9wOjFweCBzb2xpZCAjODZlZmFjO3BhZGRpbmctdG9wOjZweDttYXJnaW4tdG9wOjRweH0KLnNjYW4tZXJye2JhY2tncm91bmQ6I2ZlZjJmMjtib3JkZXI6MXB4IHNvbGlkICNmY2E1YTU7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MTRweDttYXJnaW4tYm90dG9tOjEwcHh9Ci5zY2FuLWVyciBie2NvbG9yOiM5OTFiMWJ9Ci5lbmQtYnRue3BhZGRpbmc6NnB4IDEycHg7Ym9yZGVyLXJhZGl1czo2cHg7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LC40KTtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjE1KTtjb2xvcjojZmZmO2ZvbnQtc2l6ZToxMXB4O2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXR9Ci5sb2dvdXQtYnRue3BhZGRpbmc6NHB4IDEwcHg7Ym9yZGVyLXJhZGl1czo1cHg7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LC4zKTtiYWNrZ3JvdW5kOm5vbmU7Y29sb3I6Izk0YTNiODtmb250LXNpemU6MTFweDtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0fQoubG9naW4td3JhcHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7aGVpZ2h0OjEwMHZoO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDEzNWRlZywjMGYxNzJhLCMxZTI5M2IpfQoubG9naW4tYm94e2JhY2tncm91bmQ6I2ZmZjtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzozNnB4O3dpZHRoOjM4MHB4O21heC13aWR0aDo5MHZ3fQoubG9naW4tdGl0bGV7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjI0cHg7Zm9udC13ZWlnaHQ6ODAwO21hcmdpbi1ib3R0b206NHB4fS5sb2dpbi10aXRsZSBzcGFue2NvbG9yOiM0YWRlODB9Ci5sb2dpbi1zdWJ7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjEzcHg7Y29sb3I6Izk0YTNiODttYXJnaW4tYm90dG9tOjI0cHh9Ci5sb2dpbi1lcnJ7YmFja2dyb3VuZDojZmVmMmYyO2NvbG9yOiNkYzI2MjY7cGFkZGluZzoxMHB4O2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxMnB4O21hcmdpbi1ib3R0b206MTJweDtkaXNwbGF5Om5vbmV9Ci5sb2dpbi1lcnIuc2hvd3tkaXNwbGF5OmJsb2NrfQoubG9naW4taW5wdXR7d2lkdGg6MTAwJTtwYWRkaW5nOjEycHggMTRweDtib3JkZXI6MnB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czoxMHB4O2ZvbnQtc2l6ZToxNXB4O291dGxpbmU6bm9uZTttYXJnaW4tYm90dG9tOjEwcHg7Zm9udC1mYW1pbHk6aW5oZXJpdH0KLmxvZ2luLWlucHV0OmZvY3Vze2JvcmRlci1jb2xvcjojNGFkZTgwfQoucmVnLXNlY3Rpb257Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiM0YWRlODA7bWFyZ2luOjE0cHggMCA2cHg7cGFkZGluZy10b3A6MTBweDtib3JkZXItdG9wOjFweCBzb2xpZCAjZWVlfQouc2VsbGVyLWNhcmR7YmFja2dyb3VuZDojZmZmO2JvcmRlcjoxcHggc29saWQgI2VlZTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHggMTJweDttYXJnaW4tYm90dG9tOjZweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyfQouby1zdGF0dXN7ZGlzcGxheTppbmxpbmUtYmxvY2s7cGFkZGluZzoycHggOHB4O2JvcmRlci1yYWRpdXM6NnB4O2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjYwMH0KCi5zY2FuLWxheW91dHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjIyMHB4IDFmcjtnYXA6MDttaW4taGVpZ2h0OmNhbGMoMTAwdmggLSA5MHB4KX0KLnNjYW4tc2lkZXtiYWNrZ3JvdW5kOiMwZjE3MmE7Y29sb3I6I2ZmZjtwYWRkaW5nOjE2cHg7b3ZlcmZsb3cteTphdXRvfQouc2Nhbi1zaWRlLXRpdGxle2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtsZXR0ZXItc3BhY2luZzoxcHg7Y29sb3I6Izk0YTNiODttYXJnaW4tYm90dG9tOjEwcHh9Ci5zY2FuLWlucHV0e3dpZHRoOjEwMCU7cGFkZGluZzoxMHB4IDEycHg7Ym9yZGVyOjJweCBzb2xpZCAjNGFkZTgwO2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxNHB4O2JhY2tncm91bmQ6IzFlMjkzYjtjb2xvcjojZmZmO291dGxpbmU6bm9uZTtmb250LWZhbWlseTppbmhlcml0O21hcmdpbi1ib3R0b206MTRweH0KLnNjYW4taW5wdXQ6OnBsYWNlaG9sZGVye2NvbG9yOiM2NDc0OGJ9Ci5zY2FuLWlucHV0OmZvY3Vze2JvcmRlci1jb2xvcjojMjJkM2VlfQouc2lkZS1jYXJke2JhY2tncm91bmQ6IzFlMjkzYjtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxMnB4O21hcmdpbi1ib3R0b206OHB4fQouc2lkZS1sYWJlbHtmb250LXNpemU6MTFweDtjb2xvcjojOTRhM2I4O21hcmdpbi1ib3R0b206MnB4fQouc2lkZS12YWx1ZXtmb250LXNpemU6MjRweDtmb250LXdlaWdodDo4MDA7Y29sb3I6IzRhZGU4MDt0ZXh0LWFsaWduOnJpZ2h0fQouc2lkZS12YWx1ZS5wcmljZXtjb2xvcjojNGFkZTgwO2ZvbnQtc2l6ZToyMnB4fQouc2lkZS12YWx1ZS5zdXBwbHl7Y29sb3I6I2UyZThmMDtmb250LXNpemU6MjBweH0KLnNpZGUtdmFsdWUubWFyZ2lue2NvbG9yOiNmYmJmMjQ7Zm9udC1zaXplOjIwcHh9Ci5zaWRlLXN1Yntmb250LXNpemU6MTFweDtjb2xvcjojOTRhM2I4O21hcmdpbi10b3A6MXB4O3RleHQtYWxpZ246cmlnaHR9Ci5idG4tb3JkZXItYWRke3dpZHRoOjEwMCU7cGFkZGluZzoxMHB4O2JhY2tncm91bmQ6IzMzNDE1NTtib3JkZXI6MnB4IGRhc2hlZCAjNDc1NTY5O2JvcmRlci1yYWRpdXM6OHB4O2NvbG9yOiM5NGEzYjg7Zm9udC1zaXplOjEzcHg7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdDttYXJnaW4tYm90dG9tOjEycHh9Ci5idG4tb3JkZXItYWRkOmhvdmVye2JhY2tncm91bmQ6IzQ3NTU2OTtjb2xvcjojZmZmfQouc2Nhbi1oaXN0b3J5LXRpdGxle2ZvbnQtc2l6ZToxMXB4O2NvbG9yOiM2NDc0OGI7bWFyZ2luLWJvdHRvbTo2cHg7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcn0KLnNjYW4taGlzdG9yeS1pdGVte3BhZGRpbmc6NXB4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzMzNDE1NTtmb250LXNpemU6MTFweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW59Ci5zY2FuLWhpc3RvcnktaXRlbTpsYXN0LWNoaWxke2JvcmRlcjpub25lfQouc2Nhbi1tYWlue3BhZGRpbmc6MjBweDtvdmVyZmxvdy15OmF1dG87YmFja2dyb3VuZDojZjFmNWY5fQoucHJvZHVjdC1oZWFkZXJ7YmFja2dyb3VuZDojMWUyOTNiO2NvbG9yOiNmZmY7Ym9yZGVyLXJhZGl1czoxNHB4O3BhZGRpbmc6MjBweDttYXJnaW4tYm90dG9tOjE2cHg7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmZsZXgtc3RhcnR9Ci5wcm9kdWN0LWhlYWRlciBoMntmb250LXNpemU6NDhweDtmb250LXdlaWdodDo4MDA7bWFyZ2luLWJvdHRvbTo2cHg7bGluZS1oZWlnaHQ6MS4yfQoucHJvZHVjdC1oZWFkZXIgLnN1Yntmb250LXNpemU6MTFweDtjb2xvcjojNjQ3NDhiO2ZvbnQtd2VpZ2h0OjQwMH0KLnN0b2NrLWJhZGdle3RleHQtYWxpZ246cmlnaHR9Ci5zdG9jay1iYWRnZSAubnVte2ZvbnQtc2l6ZTozNnB4O2ZvbnQtd2VpZ2h0OjkwMDtjb2xvcjojZjg3MTcxfQouc3RvY2stYmFkZ2UgLmxhYmVse2ZvbnQtc2l6ZToxMXB4O2NvbG9yOiNmY2E1YTV9Ci5zdG9jay1iYWRnZS5vayAubnVte2NvbG9yOiM0YWRlODB9Ci5zdG9jay1iYWRnZS5vayAubGFiZWx7Y29sb3I6Izg2ZWZhY30KLmFpLXNlY3Rpb257YmFja2dyb3VuZDojZmZmO2JvcmRlci1yYWRpdXM6MTRweDtwYWRkaW5nOjIwcHg7bWFyZ2luLWJvdHRvbToxNnB4O2JvcmRlcjoxcHggc29saWQgI2UyZThmMH0KLmFpLXNlY3Rpb24gaDN7Zm9udC1zaXplOjE1cHg7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi1ib3R0b206MTJweH0KLmFpLWxvYWRpbmd7dGV4dC1hbGlnbjpjZW50ZXI7Y29sb3I6Izk0YTNiODtwYWRkaW5nOjIwcHh9Ci5uYXZlci1zZWN0aW9ue2JhY2tncm91bmQ6I2ZmZjtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoyMHB4O21hcmdpbi1ib3R0b206MTZweDtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjB9Ci5uYXZlci1zZWN0aW9uIGgze2ZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjEycHh9Ci5uYXZlci1zZWN0aW9uIGgzIHNwYW57Y29sb3I6IzAzYzc1YTtmb250LXdlaWdodDo4MDB9Ci5zaG9wLWJ1dHRvbnN7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDoxMnB4O21hcmdpbi1ib3R0b206MTZweH0KLmJ0bi1uYXZlcntwYWRkaW5nOjE2cHg7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czoxMnB4O2ZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMDtjdXJzb3I6cG9pbnRlcjtjb2xvcjojZmZmO2ZvbnQtZmFtaWx5OmluaGVyaXQ7YmFja2dyb3VuZDojMDNjNzVhfQouYnRuLWNvdXBhbmd7cGFkZGluZzoxNnB4O2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6MTJweDtmb250LXNpemU6MTZweDtmb250LXdlaWdodDo3MDA7Y3Vyc29yOnBvaW50ZXI7Y29sb3I6I2ZmZjtmb250LWZhbWlseTppbmhlcml0O2JhY2tncm91bmQ6I2RjMjYyNn0KLmJ0bi1icm9hZGNhc3QtZmxvYXR7cG9zaXRpb246Zml4ZWQ7Ym90dG9tOjIwcHg7cmlnaHQ6MjBweDtwYWRkaW5nOjE0cHggMjhweDtiYWNrZ3JvdW5kOiNkYzI2MjY7Y29sb3I6I2ZmZjtib3JkZXI6bm9uZTtib3JkZXItcmFkaXVzOjEycHg7Zm9udC1zaXplOjE2cHg7Zm9udC13ZWlnaHQ6NzAwO2N1cnNvcjpwb2ludGVyO2JveC1zaGFkb3c6MCA0cHggMjBweCByZ2JhKDIyMCwzOCwzOCwuNCk7Zm9udC1mYW1pbHk6aW5oZXJpdDt6LWluZGV4OjEwMH0KLmJ0bi1icm9hZGNhc3QtZmxvYXQ6aG92ZXJ7YmFja2dyb3VuZDojYjkxYzFjfQouYnRuLWJyb2FkY2FzdC1mbG9hdC5saXZle2JhY2tncm91bmQ6I2RjMjYyNjthbmltYXRpb246cHVsc2UtYmcgMnMgaW5maW5pdGV9CkBrZXlmcmFtZXMgcHVsc2UtYmd7MCUsMTAwJXtib3gtc2hhZG93OjAgNHB4IDIwcHggcmdiYSgyMjAsMzgsMzgsLjQpfTUwJXtib3gtc2hhZG93OjAgNHB4IDMwcHggcmdiYSgyMjAsMzgsMzgsLjgpfX0KLmVtcHR5LXNjYW57dGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzo2MHB4IDIwcHg7Y29sb3I6Izk0YTNiOH0KLmVtcHR5LXNjYW4gLmljb257Zm9udC1zaXplOjQ4cHg7bWFyZ2luLWJvdHRvbToxMnB4fQouZW1wdHktc2NhbiAubXNne2ZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjUwMH0KQG1lZGlhKG1heC13aWR0aDo3NjhweCl7LnNjYW4tbGF5b3V0e2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9LnNjYW4tc2lkZXttYXgtaGVpZ2h0OjMwMHB4fX0KCi5tb2RhbC1vdmVybGF5e2Rpc3BsYXk6bm9uZTtwb3NpdGlvbjpmaXhlZDt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjUpO3otaW5kZXg6OTk5O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyfQoubW9kYWwtb3ZlcmxheS5zaG93e2Rpc3BsYXk6ZmxleH0KLm1vZGFsLWJveHtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyLXJhZGl1czoxNHB4O3BhZGRpbmc6MjRweDt3aWR0aDozNjBweDttYXgtd2lkdGg6OTB2dzt0ZXh0LWFsaWduOmNlbnRlcjtib3gtc2hhZG93OjAgMTBweCA0MHB4IHJnYmEoMCwwLDAsLjIpfQoubW9kYWwtYm94IGgze2ZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMDttYXJnaW4tYm90dG9tOjhweH0KLm1vZGFsLWJveCBwe2ZvbnQtc2l6ZToxM3B4O2NvbG9yOiM2NjY7bWFyZ2luLWJvdHRvbToxNnB4fQoubW9kYWwtYnRuc3tkaXNwbGF5OmZsZXg7Z2FwOjhweH0KLm1vZGFsLWJ0bnMgYnV0dG9ue2ZsZXg6MTtwYWRkaW5nOjEwcHg7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czo4cHg7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NjAwO2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXR9CgoubG9hZGluZy1vdmVybGF5e2Rpc3BsYXk6bm9uZTtwb3NpdGlvbjpmaXhlZDt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjYpO3otaW5kZXg6OTk4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2ZsZXgtZGlyZWN0aW9uOmNvbHVtbn0KLmxvYWRpbmctb3ZlcmxheS5zaG93e2Rpc3BsYXk6ZmxleH0KLmxvYWRpbmctc3Bpbm5lcnt3aWR0aDo0MHB4O2hlaWdodDo0MHB4O2JvcmRlcjo0cHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwuMyk7Ym9yZGVyLXRvcDo0cHggc29saWQgIzRhZGU4MDtib3JkZXItcmFkaXVzOjUwJTthbmltYXRpb246c3BpbiAxcyBsaW5lYXIgaW5maW5pdGV9CkBrZXlmcmFtZXMgc3Bpbnt0b3t0cmFuc2Zvcm06cm90YXRlKDM2MGRlZyl9fQoucmVnLWhpbnR7Zm9udC1zaXplOjExcHg7Y29sb3I6I2RjMjYyNjttYXJnaW46LTZweCAwIDhweCA0cHg7bWluLWhlaWdodDoxNHB4fQoucmVnLWhpbnQub2t7Y29sb3I6IzE2YTM0YX0KLmNoLWJ0bntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7cGFkZGluZzoxMHB4IDZweDtib3JkZXI6MnB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czoxMHB4O2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjojNjQ3NDhiO2N1cnNvcjpwb2ludGVyO3RleHQtYWxpZ246Y2VudGVyO3RyYW5zaXRpb246YWxsIC4xNXN9Ci5jaC1idG46aGFzKGlucHV0OmNoZWNrZWQpe2JvcmRlci1jb2xvcjojNGFkZTgwO2JhY2tncm91bmQ6I2YwZmRmNDtjb2xvcjojMTY2NTM0fQouY2gtYnRuIHNwYW57cG9pbnRlci1ldmVudHM6bm9uZX0KLnRvYXN0LXdyYXB7cG9zaXRpb246Zml4ZWQ7dG9wOjIwcHg7bGVmdDo1MCU7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7ei1pbmRleDoxMDAwO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7cG9pbnRlci1ldmVudHM6bm9uZX0KLnRvYXN0e3BvaW50ZXItZXZlbnRzOmF1dG87YmFja2dyb3VuZDojZmZmO2JvcmRlci1yYWRpdXM6MTRweDtwYWRkaW5nOjE2cHggMjRweDtib3gtc2hhZG93OjAgOHB4IDMwcHggcmdiYSgwLDAsMCwuMTUpO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHg7YW5pbWF0aW9uOnRvYXN0SW4gLjNzIGVhc2U7bWF4LXdpZHRoOjQwMHB4O2ZvbnQtc2l6ZToxM3B4fQoudG9hc3Qub3V0e2FuaW1hdGlvbjp0b2FzdE91dCAuM3MgZWFzZSBmb3J3YXJkc30KLnRvYXN0LWljb257d2lkdGg6MzZweDtoZWlnaHQ6MzZweDtib3JkZXItcmFkaXVzOjUwJTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjE4cHg7ZmxleC1zaHJpbms6MH0KLnRvYXN0LXN1Y2Nlc3MgLnRvYXN0LWljb257YmFja2dyb3VuZDojZDFmYWU1O2NvbG9yOiMwNjVmNDZ9Ci50b2FzdC1lcnJvciAudG9hc3QtaWNvbntiYWNrZ3JvdW5kOiNmZWYyZjI7Y29sb3I6I2RjMjYyNn0KLnRvYXN0LWluZm8gLnRvYXN0LWljb257YmFja2dyb3VuZDojZGJlYWZlO2NvbG9yOiMxZTQwYWZ9Ci50b2FzdC1tc2d7Zm9udC13ZWlnaHQ6NTAwO2NvbG9yOiMzMzQxNTU7bGluZS1oZWlnaHQ6MS40fQpAa2V5ZnJhbWVzIHRvYXN0SW57ZnJvbXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTIwcHgpfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgwKX19CkBrZXlmcmFtZXMgdG9hc3RPdXR7ZnJvbXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMCl9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGVZKC0yMHB4KX19CkBrZXlmcmFtZXMgc2tlbGV0b257MCV7b3BhY2l0eTouNn01MCV7b3BhY2l0eTouM30xMDAle29wYWNpdHk6LjZ9fQo8L3N0eWxlPgo8c2NyaXB0IHNyYz0iaHR0cHM6Ly9jZG5qcy5jbG91ZGZsYXJlLmNvbS9hamF4L2xpYnMveGxzeC8wLjE4LjUveGxzeC5mdWxsLm1pbi5qcyI+PC9zY3JpcHQ+CjwvaGVhZD4KPGJvZHk+Cgo8IS0tIOKVkOKVkOKVkCDroZzqt7jsnbgg7ZmU66m0IOKVkOKVkOKVkCAtLT4KPGRpdiBpZD0ibG9naW5TY3JlZW4iIGNsYXNzPSJsb2dpbi13cmFwIiBzdHlsZT0iZGlzcGxheTpmbGV4Ij4KPGRpdiBjbGFzcz0ibG9naW4tYm94Ij4KPGRpdiBjbGFzcz0ibG9naW4tdGl0bGUiPuqzteyLnSDrnbzsnbTruIw8YnI+PHNwYW4+7Jq07JiB6rSA66asPC9zcGFuPiDsi5zsiqTthZw8L2Rpdj4KPGRpdiBjbGFzcz0ibG9naW4tc3ViIj5MaXZlIENvbW1lcmNlIE1hbmFnZW1lbnQgU3lzdGVtPC9kaXY+CjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6IzU1NTttYXJnaW4tdG9wOjRweCI+djIuNTwvZGl2Pgo8ZGl2IGNsYXNzPSJsb2dpbi1lcnIiIGlkPSJsb2dpbkVyciI+PC9kaXY+Cgo8ZGl2IGlkPSJsb2dpbkZvcm0iPgogIDxpbnB1dCB0eXBlPSJ0ZXh0IiBjbGFzcz0ibG9naW4taW5wdXQiIGlkPSJsb2dpbklkIiBwbGFjZWhvbGRlcj0i7JWE7J2065SUIiBhdXRvZm9jdXM+CiAgPGlucHV0IHR5cGU9InBhc3N3b3JkIiBjbGFzcz0ibG9naW4taW5wdXQiIGlkPSJsb2dpblB3IiBwbGFjZWhvbGRlcj0i67mE67CA67KI7Zi4Ij4KICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLWdyZWVuIiBvbmNsaWNrPSJkb0xvZ2luQWN0aW9uKCkiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjhweCI+66Gc6re47J24PC9idXR0b24+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBzdHlsZT0iYmFja2dyb3VuZDojZTJlOGYwO2NvbG9yOiM2NDc0OGIiIG9uY2xpY2s9InNob3dSZWdTdGVwKDEpIj7tmozsm5DqsIDsnoU8L2J1dHRvbj4KPC9kaXY+Cgo8ZGl2IGlkPSJyZWdTdGVwMSIgY2xhc3M9ImhpZGRlbiI+CiAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O21hcmdpbi1ib3R0b206MTZweCI+CiAgICA8ZGl2IHN0eWxlPSJ3aWR0aDoyOHB4O2hlaWdodDoyOHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6IzRhZGU4MDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNmZmYiPjE8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjcwMCI+6riw67O4IOygleuztDwvZGl2PgogICAgPGRpdiBzdHlsZT0iZmxleDoxO2hlaWdodDoycHg7YmFja2dyb3VuZDojZTJlOGYwO2JvcmRlci1yYWRpdXM6MnB4Ij48ZGl2IHN0eWxlPSJ3aWR0aDo1MCU7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDojNGFkZTgwO2JvcmRlci1yYWRpdXM6MnB4Ij48L2Rpdj48L2Rpdj4KICAgIDxkaXYgc3R5bGU9IndpZHRoOjI4cHg7aGVpZ2h0OjI4cHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDojZTJlOGYwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo2MDA7Y29sb3I6Izk0YTNiOCI+MjwvZGl2PgogIDwvZGl2PgogIDxpbnB1dCBjbGFzcz0ibG9naW4taW5wdXQiIGlkPSJyZWdJZCIgcGxhY2Vob2xkZXI9IuyVhOydtOuUlCAqIiBvbmlucHV0PSJ2YWxpZGF0ZVJlZ0ZpZWxkKHRoaXMsJ2lkJykiPgogIDxkaXYgaWQ9InJlZ0lkRXJyIiBjbGFzcz0icmVnLWhpbnQiPjwvZGl2PgogIDxpbnB1dCBjbGFzcz0ibG9naW4taW5wdXQiIGlkPSJyZWdQdyIgdHlwZT0icGFzc3dvcmQiIHBsYWNlaG9sZGVyPSLruYTrsIDrsojtmLggKDjsnpAg7J207IOBKSAqIiBvbmlucHV0PSJ2YWxpZGF0ZVJlZ0ZpZWxkKHRoaXMsJ3B3JykiPgogIDxkaXYgaWQ9InJlZ1B3RXJyIiBjbGFzcz0icmVnLWhpbnQiPjwvZGl2PgogIDxpbnB1dCBjbGFzcz0ibG9naW4taW5wdXQiIGlkPSJyZWdOYW1lIiBwbGFjZWhvbGRlcj0i7J2066aEICjsi6TrqoUpICoiPgogIDxpbnB1dCBjbGFzcz0ibG9naW4taW5wdXQiIGlkPSJyZWdQaG9uZSIgcGxhY2Vob2xkZXI9Iu2ctOuMgO2PsCDrsojtmLggKDAxMC0wMDAwLTAwMDApICoiIG9uaW5wdXQ9ImZvcm1hdFBob25lKHRoaXMpIiBtYXhsZW5ndGg9IjEzIj4KICA8ZGl2IGlkPSJyZWdQaG9uZUVyciIgY2xhc3M9InJlZy1oaW50Ij48L2Rpdj4KICA8aW5wdXQgY2xhc3M9ImxvZ2luLWlucHV0IiBpZD0icmVnRW1haWwiIHBsYWNlaG9sZGVyPSLsnbTrqZTsnbwgKiIgb25pbnB1dD0idmFsaWRhdGVSZWdGaWVsZCh0aGlzLCdlbWFpbCcpIj4KICA8ZGl2IGlkPSJyZWdFbWFpbEVyciIgY2xhc3M9InJlZy1oaW50Ij48L2Rpdj4KICA8ZGl2IGNsYXNzPSJyZWctc2VjdGlvbiI+7IaM7IaNIOq0gOumrOyekCDshKDtg50gKjwvZGl2PgogIDxzZWxlY3QgY2xhc3M9ImxvZ2luLWlucHV0IiBpZD0icmVnQWRtaW5JZCIgc3R5bGU9ImFwcGVhcmFuY2U6YXV0byI+PG9wdGlvbiB2YWx1ZT0iIj7qtIDrpqzsnpAg7ISg7YOdPC9vcHRpb24+PC9zZWxlY3Q+CiAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1ncmVlbiIgb25jbGljaz0iZG9SZWdTdGVwMSgpIiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo4cHgiPuqwgOyehe2VmOq4sDwvYnV0dG9uPgogIDxidXR0b24gY2xhc3M9ImJ0biIgc3R5bGU9ImJhY2tncm91bmQ6I2UyZThmMDtjb2xvcjojNjQ3NDhiIiBvbmNsaWNrPSJzaG93TG9naW5Gb3JtKCkiPuuPjOyVhOqwgOq4sDwvYnV0dG9uPgo8L2Rpdj4KCjxkaXYgaWQ9InJlZ1N0ZXAyIiBjbGFzcz0iaGlkZGVuIj4KICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7bWFyZ2luLWJvdHRvbToxNnB4Ij4KICAgIDxkaXYgc3R5bGU9IndpZHRoOjI4cHg7aGVpZ2h0OjI4cHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDojNGFkZTgwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtmb250LXNpemU6MTRweDtjb2xvcjojZmZmIj7inJM8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiM0YWRlODA7Zm9udC13ZWlnaHQ6NjAwIj7qsIDsnoXsmYTro4w8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZsZXg6MTtoZWlnaHQ6MnB4O2JhY2tncm91bmQ6IzRhZGU4MDtib3JkZXItcmFkaXVzOjJweCI+PC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJ3aWR0aDoyOHB4O2hlaWdodDoyOHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6IzRhZGU4MDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNmZmYiPjI8L2Rpdj4KICA8L2Rpdj4KICA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW4tYm90dG9tOjE2cHgiPgogICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjI0cHg7bWFyZ2luLWJvdHRvbTo0cHgiPvCfjok8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMTY2NTM0Ij7qsIDsnoUg7Iug7LKt7J20IOyZhOujjOuQmOyXiOyKteuLiOuLpCE8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiM4ODg7bWFyZ2luLXRvcDo0cHgiPuq0gOumrOyekCDsirnsnbgg7ZuEIOuhnOq3uOyduCDqsIDriqXtlanri4jri6QuIOy2lOqwgCDsoJXrs7Trpbwg66+466asIOyeheugpe2VtOuRkOyEuOyalDwvZGl2PgogIDwvZGl2PgogIDxkaXYgY2xhc3M9InJlZy1zZWN0aW9uIj7rsKnshqEg7LGE64SQICjrs7XsiJgg7ISg7YOdKTwvZGl2PgogIDxkaXYgaWQ9ImNoYW5uZWxHcmlkIiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyIDFmcjtnYXA6NnB4O21hcmdpbi1ib3R0b206MTRweCI+CiAgICA8bGFiZWwgY2xhc3M9ImNoLWJ0biI+PGlucHV0IHR5cGU9ImNoZWNrYm94IiB2YWx1ZT0i6re466a9IiBjbGFzcz0iY2gtY2hlY2siIGhpZGRlbj48c3Bhbj7qt7jrpr08L3NwYW4+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iY2gtYnRuIj48aW5wdXQgdHlwZT0iY2hlY2tib3giIHZhbHVlPSLtgbTrpq3rqZTsnbTtirgiIGNsYXNzPSJjaC1jaGVjayIgaGlkZGVuPjxzcGFuPu2BtOumreuplOydtO2KuDwvc3Bhbj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJjaC1idG4iPjxpbnB1dCB0eXBlPSJjaGVja2JveCIgdmFsdWU9IuycoO2KnOu4jCIgY2xhc3M9ImNoLWNoZWNrIiBoaWRkZW4+PHNwYW4+7Jyg7Yqc67iMPC9zcGFuPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImNoLWJ0biI+PGlucHV0IHR5cGU9ImNoZWNrYm94IiB2YWx1ZT0i7Yux7YahIiBjbGFzcz0iY2gtY2hlY2siIGhpZGRlbj48c3Bhbj7ti7HthqE8L3NwYW4+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iY2gtYnRuIj48aW5wdXQgdHlwZT0iY2hlY2tib3giIHZhbHVlPSLqsJzsnbjtlIzrnqvtj7wiIGNsYXNzPSJjaC1jaGVjayIgaGlkZGVuPjxzcGFuPuqwnOyduO2UjOueq+2PvDwvc3Bhbj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJjaC1idG4iPjxpbnB1dCB0eXBlPSJjaGVja2JveCIgdmFsdWU9Iuq4sO2DgCIgY2xhc3M9ImNoLWNoZWNrIiBoaWRkZW4+PHNwYW4+6riw7YOAPC9zcGFuPjwvbGFiZWw+CiAgPC9kaXY+CiAgPGlucHV0IGNsYXNzPSJsb2dpbi1pbnB1dCIgaWQ9InJlZ0V0Y0NoYW5uZWwiIHBsYWNlaG9sZGVyPSLquLDtg4Ag7LGE64SQ66qFIOyeheugpSIgc3R5bGU9ImRpc3BsYXk6bm9uZSI+CiAgPGRpdiBjbGFzcz0icmVnLXNlY3Rpb24iPuydvCDtj4nqt6Ag66ek7LacPC9kaXY+CiAgPGRpdiBpZD0ic2FsZXNHcmlkIiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDo2cHg7bWFyZ2luLWJvdHRvbToxNnB4Ij4KICAgIDxsYWJlbCBjbGFzcz0iY2gtYnRuIHNpbmdsZSI+PGlucHV0IHR5cGU9InJhZGlvIiBuYW1lPSJhdmdTYWxlcyIgdmFsdWU9IjEwMOunjOybkCDsnbTtlZgiIGhpZGRlbj48c3Bhbj4xMDDrp4zsm5Ag7J207ZWYPC9zcGFuPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImNoLWJ0biBzaW5nbGUiPjxpbnB1dCB0eXBlPSJyYWRpbyIgbmFtZT0iYXZnU2FsZXMiIHZhbHVlPSIxMDB+NTAw66eM7JuQIiBoaWRkZW4+PHNwYW4+MTAwfjUwMOunjOybkDwvc3Bhbj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJjaC1idG4gc2luZ2xlIj48aW5wdXQgdHlwZT0icmFkaW8iIG5hbWU9ImF2Z1NhbGVzIiB2YWx1ZT0iNTAwfjEwMDDrp4zsm5AiIGhpZGRlbj48c3Bhbj41MDB+MTAwMOunjOybkDwvc3Bhbj48L2xhYmVsPgogICAgPGxhYmVsIGNsYXNzPSJjaC1idG4gc2luZ2xlIj48aW5wdXQgdHlwZT0icmFkaW8iIG5hbWU9ImF2Z1NhbGVzIiB2YWx1ZT0iMTAwMH4zMDAw66eM7JuQIiBoaWRkZW4+PHNwYW4+MTAwMH4zMDAw66eM7JuQPC9zcGFuPjwvbGFiZWw+CiAgICA8bGFiZWwgY2xhc3M9ImNoLWJ0biBzaW5nbGUiPjxpbnB1dCB0eXBlPSJyYWRpbyIgbmFtZT0iYXZnU2FsZXMiIHZhbHVlPSIzMDAw66eMfjHslrXsm5AiIGhpZGRlbj48c3Bhbj4zMDAw66eMfjHslrXsm5A8L3NwYW4+PC9sYWJlbD4KICAgIDxsYWJlbCBjbGFzcz0iY2gtYnRuIHNpbmdsZSI+PGlucHV0IHR5cGU9InJhZGlvIiBuYW1lPSJhdmdTYWxlcyIgdmFsdWU9IjHslrXsm5Ag7J207IOBIiBoaWRkZW4+PHNwYW4+MeyWteybkCDsnbTsg4E8L3NwYW4+PC9sYWJlbD4KICA8L2Rpdj4KICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLWdyZWVuIiBvbmNsaWNrPSJkb1JlZ1N0ZXAyKCkiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjhweCI+7KCA7J6l7ZWY6rOgIOyLnOyeke2VmOq4sDwvYnV0dG9uPgogIDxidXR0b24gY2xhc3M9ImJ0biIgc3R5bGU9ImJhY2tncm91bmQ6I2YxZjVmOTtjb2xvcjojNjQ3NDhiIiBvbmNsaWNrPSJzaG93TG9naW5Gb3JtKCkiPuqxtOuEiOubsOq4sCDihpI8L2J1dHRvbj4KPC9kaXY+CjwvZGl2Pgo8L2Rpdj4KCjwhLS0g4pWQ4pWQ4pWQIOuplOyduCDslbEg4pWQ4pWQ4pWQIC0tPgo8ZGl2IGlkPSJtYWluQXBwIiBzdHlsZT0iZGlzcGxheTpub25lIj4KCjxkaXYgY2xhc3M9InRvcCI+CiAgPGRpdiBjbGFzcz0ibG9nbyI+PHNwYW4+65287J2067iMPC9zcGFuPiDsmrTsmIHqtIDrpqw8L2Rpdj4KICA8ZGl2IGNsYXNzPSJ1c2VyIj4KICAgIDxkaXYgY2xhc3M9ImF2YXRhciIgaWQ9InVzZXJBdmF0YXIiPk08L2Rpdj4KICAgIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTJweCIgaWQ9InVzZXJOYW1lIj7snKDsoIA8L3NwYW4+CiAgICA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Y29sb3I6Izk0YTNiOCIgaWQ9InVzZXJSb2xlIj48L3NwYW4+CiAgICA8YnV0dG9uIGNsYXNzPSJsb2dvdXQtYnRuIiBvbmNsaWNrPSJkb0xvZ291dCgpIj7roZzqt7jslYTsm4M8L2J1dHRvbj4KICA8L2Rpdj4KPC9kaXY+Cgo8ZGl2IGNsYXNzPSJ0YWJzIiBpZD0ibWFpblRhYnMiPjwvZGl2PgoKPGRpdiBjbGFzcz0iY29udGVudCI+Cgo8IS0tIOKVkOKVkOKVkCDsiqTsupQg7YOtICgy7Lus65+8KSDilZDilZDilZAgLS0+CjxkaXYgaWQ9InRhYi1zY2FuIj4KICA8ZGl2IGNsYXNzPSJzY2FuLWxheW91dCI+CiAgICA8IS0tIOyZvOyqvSDsgqzsnbTrk5zrsJQgLS0+CiAgICA8ZGl2IGNsYXNzPSJzY2FuLXNpZGUiPgogICAgICA8ZGl2IGNsYXNzPSJzY2FuLXNpZGUtdGl0bGUiPkJBUkNPREUgU0NBTiA8c3BhbiBpZD0iY2FjaGVTdGF0dXMiIHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojOTRhM2I4O2ZvbnQtd2VpZ2h0OjQwMCI+PC9zcGFuPjwvZGl2PgogICAgICA8aW5wdXQgY2xhc3M9InNjYW4taW5wdXQiIGlkPSJiYXJjb2RlSW5wdXQiIHBsYWNlaG9sZGVyPSLrsJTsvZTrk5zrpbwg7Iqk7LqUIO2VmOyEuOyalCIgYXV0b2ZvY3VzCiAgICAgICAgICAgICBvbmtleWRvd249ImlmKGV2ZW50LmtleT09PSdFbnRlcicpe2RvU2NhbigpO2V2ZW50LnByZXZlbnREZWZhdWx0KCk7fSI+CiAgICAgIDxkaXYgaWQ9Imxhc3RCYXJjb2RlIiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Y29sb3I6IzQ3NTU2OTttYXJnaW4tdG9wOi0xMHB4O21hcmdpbi1ib3R0b206MTBweDt0ZXh0LWFsaWduOmNlbnRlciI+PC9kaXY+CgogICAgICA8ZGl2IGlkPSJzaWRlUHJvZHVjdEluZm8iPgogICAgICAgIDxkaXYgY2xhc3M9InNpZGUtY2FyZCI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzaWRlLWxhYmVsIj7tmITsnqwg7J6s6rOgICjsoITssrQpPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzaWRlLXZhbHVlIiBpZD0ic2lkZVN0b2NrIj4tPC9kaXY+CiAgICAgICAgICA8ZGl2IGlkPSJzdG9ja0RldGFpbCIgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM2NDc0OGI7bWFyZ2luLXRvcDo0cHgiPjwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InNpZGUtY2FyZCI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzaWRlLWxhYmVsIj7tjJDrp6TqsIA8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9InNpZGUtdmFsdWUgcHJpY2UiIGlkPSJzaWRlU2FsZSI+LTwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InNpZGUtY2FyZCI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzaWRlLWxhYmVsIj7qs7XquInqsIA8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9InNpZGUtdmFsdWUgc3VwcGx5IiBpZD0ic2lkZVN1cHBseSI+LTwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InNpZGUtY2FyZCI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzaWRlLWxhYmVsIj7rp4jsp4TsnKggLyDqsJzri7kg7J207J21PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJzaWRlLXZhbHVlIG1hcmdpbiIgaWQ9InNpZGVNYXJnaW4iPi08L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9InNpZGUtc3ViIiBpZD0ic2lkZVByb2ZpdCI+PC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgoKICAgICAgCgogICAgICA8ZGl2IHN0eWxlPSJib3JkZXItdG9wOjFweCBzb2xpZCAjMzM0MTU1O3BhZGRpbmctdG9wOjEwcHg7bWFyZ2luLWJvdHRvbToxMHB4Ij4KICAgICAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzRhZGU4MDttYXJnaW4tYm90dG9tOjZweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyIj4KICAgICAgICAgIDxzcGFuPvCfk50g7KO866y4IOygkeyImDwvc3Bhbj4KICAgICAgICAgIDxzcGFuIGlkPSJvcmRlclBhZENvdW50IiBzdHlsZT0iY29sb3I6Izk0YTNiODtmb250LXdlaWdodDo0MDAiPjDqsbQ8L3NwYW4+CiAgICAgICAgPC9kaXY+CiAgICAgICAgPGRpdiBpZD0ib3JkZXJQYWRGb3JtIiBzdHlsZT0iZGlzcGxheTpub25lIj4KICAgICAgICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM5NGEzYjg7bWFyZ2luLWJvdHRvbTo0cHgiIGlkPSJvcmRlclBhZFByb2R1Y3QiPuyDge2SiDogLTwvZGl2PgogICAgICAgICAgPGlucHV0IGlkPSJvcE5hbWUiIGNsYXNzPSJzY2FuLWlucHV0IiBwbGFjZWhvbGRlcj0i7KO866y47J6QIOydtOumhCIgc3R5bGU9InBhZGRpbmc6N3B4IDEwcHg7Zm9udC1zaXplOjEycHg7bWFyZ2luLWJvdHRvbTo0cHg7Ym9yZGVyLWNvbG9yOiMzMzQxNTUiIG9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT09J0VudGVyJyl7YWRkT3JkZXJQYWQoKTtldmVudC5wcmV2ZW50RGVmYXVsdCgpO30iPgogICAgICAgICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDo0cHg7bWFyZ2luLWJvdHRvbTo0cHgiPgogICAgICAgICAgICA8aW5wdXQgaWQ9Im9wUXR5IiB0eXBlPSJudW1iZXIiIHZhbHVlPSIxIiBtaW49IjEiIGNsYXNzPSJzY2FuLWlucHV0IiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6N3B4O2ZvbnQtc2l6ZToxMnB4O3RleHQtYWxpZ246Y2VudGVyO21hcmdpbi1ib3R0b206MDtib3JkZXItY29sb3I6IzMzNDE1NSIgcGxhY2Vob2xkZXI9IuyImOufiSI+CiAgICAgICAgICAgIDxpbnB1dCBpZD0ib3BPcHRpb24iIGNsYXNzPSJzY2FuLWlucHV0IiBwbGFjZWhvbGRlcj0i7Ji17IWYL+uplOuqqCIgc3R5bGU9ImZsZXg6MjtwYWRkaW5nOjdweDtmb250LXNpemU6MTJweDttYXJnaW4tYm90dG9tOjA7Ym9yZGVyLWNvbG9yOiMzMzQxNTUiPgogICAgICAgICAgPC9kaXY+CiAgICAgICAgICA8YnV0dG9uIG9uY2xpY2s9ImFkZE9yZGVyUGFkKCkiIHN0eWxlPSJ3aWR0aDoxMDAlO3BhZGRpbmc6N3B4O2JhY2tncm91bmQ6IzRhZGU4MDtjb2xvcjojMGYxNzJhO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6NnB4O2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0Ij4rIOyjvOusuCDstpTqsIA8L2J1dHRvbj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJvcmRlclBhZExpc3QiIHN0eWxlPSJtYXJnaW4tdG9wOjZweDttYXgtaGVpZ2h0OjE4MHB4O292ZXJmbG93LXk6YXV0byI+PC9kaXY+CiAgICAgICAgPGRpdiBpZD0ib3JkZXJQYWRBY3Rpb25zIiBzdHlsZT0iZGlzcGxheTpub25lO21hcmdpbi10b3A6NnB4Ij4KICAgICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtwYWRkaW5nOjZweCAwO2JvcmRlci10b3A6MXB4IHNvbGlkICMzMzQxNTU7Zm9udC1zaXplOjExcHgiPgogICAgICAgICAgICA8c3BhbiBzdHlsZT0iY29sb3I6Izk0YTNiOCI+7ZWp6rOEPC9zcGFuPgogICAgICAgICAgICA8c3BhbiBpZD0ib3JkZXJQYWRUb3RhbCIgc3R5bGU9ImNvbG9yOiM0YWRlODA7Zm9udC13ZWlnaHQ6NzAwIj4w6rG0IC8g4oKpMDwvc3Bhbj4KICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPGJ1dHRvbiBvbmNsaWNrPSJkb3dubG9hZE9yZGVyUGFkKCkiIHN0eWxlPSJ3aWR0aDoxMDAlO3BhZGRpbmc6N3B4O2JhY2tncm91bmQ6IzNiODJmNjtjb2xvcjojZmZmO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6NnB4O2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0O21hcmdpbi10b3A6NHB4Ij7wn5OlIOuwnOyjvOyEnCDri6TsmrTroZzrk5w8L2J1dHRvbj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InNjYW4taGlzdG9yeS10aXRsZSI+CiAgICAgICAgPHNwYW4+7LWc6re8IOyKpOy6lDwvc3Bhbj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgaWQ9InNjYW5IaXN0b3J5Ij48ZGl2IHN0eWxlPSJjb2xvcjojNDc1NTY5O2ZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6OHB4IDAiPuyKpOy6lCDquLDroZ3snbQg7JeG7Iq164uI64ukPC9kaXY+PC9kaXY+CiAgICA8L2Rpdj4KCiAgICA8IS0tIOyYpOuluOyqvSDrqZTsnbggLS0+CiAgICA8ZGl2IGNsYXNzPSJzY2FuLW1haW4iPgogICAgICA8ZGl2IGlkPSJzY2FuTWFpbkNvbnRlbnQiPgogICAgICAgIDxkaXYgY2xhc3M9ImVtcHR5LXNjYW4iPgogICAgICAgICAgPGRpdiBjbGFzcz0iaWNvbiI+8J+TtzwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ibXNnIj7rsJTsvZTrk5zrpbwg7Iqk7LqU7ZWY66m0IOyDge2SiCDsoJXrs7TqsIAg7ZGc7Iuc65Cp64uI64ukPC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgPC9kaXY+CgogIDwhLS0g67Cp7IahIOyLnOyekS/sooXro4wg7ZSM66Gc7YyFIOuyhO2KvCAtLT4KICA8YnV0dG9uIGNsYXNzPSJidG4tYnJvYWRjYXN0LWZsb2F0IiBpZD0iYnRuQnJvYWRjYXN0RmxvYXQiIG9uY2xpY2s9InRvZ2dsZUJyb2FkY2FzdE1vZGFsKCkiPvCflLQg67Cp7IahIOyLnOyekTwvYnV0dG9uPgoKICA8IS0tIOuwqeyGoSDshKTsoJUg66qo64usIC0tPgogIDxkaXYgaWQ9ImJyb2FkY2FzdE1vZGFsIiBzdHlsZT0iZGlzcGxheTpub25lO3Bvc2l0aW9uOmZpeGVkO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuNik7ei1pbmRleDoyMDA7ZGlzcGxheTpub25lO2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyIj4KICAgIDxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXItcmFkaXVzOjE2cHg7cGFkZGluZzoyNHB4O3dpZHRoOjQwMHB4O21heC13aWR0aDo5MHZ3Ij4KICAgICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjE2cHg7Zm9udC13ZWlnaHQ6NzAwO21hcmdpbi1ib3R0b206MTZweCI+67Cp7IahIOyEpOyglTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJsYWJlbCI+67Cp7Iah7J6lIOy9lOuTnDwvZGl2PgogICAgICA8aW5wdXQgY2xhc3M9ImlucHV0IiBpZD0iYmNDb2RlIiBwbGFjZWhvbGRlcj0i7JiIOiBCQy0wMzE1ICjruYTsm4zrkZDrqbQg7J6Q64+Z7IOd7ISxKSI+CiAgICAgIDxkaXYgY2xhc3M9ImxhYmVsIj7tlIzrnqvtj7wg7ISg7YOdICo8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGxhdGZvcm1zIiBpZD0icGxhdGZvcm1HcmlkIj48L2Rpdj4KICAgICAgPGRpdiBpZD0iZXRjTWVtb1dyYXAiIGNsYXNzPSJoaWRkZW4iPgogICAgICAgIDxkaXYgY2xhc3M9ImxhYmVsIj7tlIzrnqvtj7wg66mU66qoPC9kaXY+CiAgICAgICAgPGlucHV0IGNsYXNzPSJpbnB1dCIgaWQ9ImV0Y01lbW8iIHBsYWNlaG9sZGVyPSLtlIzrnqvtj7wg7J2066aEIOyeheugpSI+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7Z2FwOjhweDttYXJnaW4tdG9wOjhweCI+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1yZWQiIGlkPSJidG5TdGFydCIgZGlzYWJsZWQgb25jbGljaz0iZG9TdGFydEJyb2FkY2FzdCgpIiBzdHlsZT0iZmxleDoxIj7rsKnshqEg7Iuc7J6RPC9idXR0b24+CiAgICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIiBzdHlsZT0iYmFja2dyb3VuZDojZTJlOGYwO2NvbG9yOiM2NDc0OGI7ZmxleDoxIiBvbmNsaWNrPSJjbG9zZUJyb2FkY2FzdE1vZGFsKCkiPuuLq+q4sDwvYnV0dG9uPgogICAgICA8L2Rpdj4KICAgIDwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjwhLS0g4pWQ4pWQ4pWQIOuwnOyjvCDtg60g4pWQ4pWQ4pWQIC0tPgo8ZGl2IGlkPSJ0YWItb3JkZXIiIGNsYXNzPSJoaWRkZW4iPgogIAogIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcjttYXJnaW4tYm90dG9tOjhweCI+CiAgICAgIDxkaXYgY2xhc3M9ImNhcmQtdGl0bGUiIHN0eWxlPSJtYXJnaW46MCI+8J+TpCDrsJzso7zshJwg7JeF66Gc65OcPC9kaXY+CiAgICAgIDxidXR0b24gb25jbGljaz0iZG93bmxvYWRPcmRlclRlbXBsYXRlKCkiIHN0eWxlPSJwYWRkaW5nOjhweCAxNnB4O2JhY2tncm91bmQ6IzNiODJmNjtjb2xvcjojZmZmO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0Ij7wn5OlIOuwnOyjvOyEnCDslpHsi50g64uk7Jq066Gc65OcPC9idXR0b24+CiAgICA8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6NnB4O21hcmdpbi1ib3R0b206MTJweCI+CiAgICAgIDxidXR0b24gY2xhc3M9Im9yZGVyLXR5cGUtYnRuIGFjdGl2ZSIgb25jbGljaz0ic2VsZWN0T3JkZXJUeXBlKHRoaXMsJ+ydvOuwmCcpIiBkYXRhLXR5cGU9IuydvOuwmCIgc3R5bGU9ImZsZXg6MTtwYWRkaW5nOjEwcHggOHB4O2JvcmRlci1yYWRpdXM6OHB4O2JvcmRlcjoycHggc29saWQgIzRhZGU4MDtiYWNrZ3JvdW5kOiNmMGZkZjQ7Y29sb3I6IzE2NjUzNDtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdCI+8J+TiyDsnbzrsJjrsJzso7zshJw8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ib3JkZXItdHlwZS1idG4iIG9uY2xpY2s9InNlbGVjdE9yZGVyVHlwZSh0aGlzLCfqt7jrpr0nKSIgZGF0YS10eXBlPSLqt7jrpr0iIHN0eWxlPSJmbGV4OjE7cGFkZGluZzoxMHB4IDhweDtib3JkZXItcmFkaXVzOjhweDtib3JkZXI6MnB4IHNvbGlkICNlMmU4ZjA7YmFja2dyb3VuZDojZmZmO2NvbG9yOiM2NDc0OGI7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQiPvCfm5Ig6re466a967Cc7KO87IScPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9Im9yZGVyLXR5cGUtYnRuIiBvbmNsaWNrPSJzZWxlY3RPcmRlclR5cGUodGhpcywn7YG066at66mU7J207Yq4JykiIGRhdGEtdHlwZT0i7YG066at66mU7J207Yq4IiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6MTBweCA4cHg7Ym9yZGVyLXJhZGl1czo4cHg7Ym9yZGVyOjJweCBzb2xpZCAjZTJlOGYwO2JhY2tncm91bmQ6I2ZmZjtjb2xvcjojNjQ3NDhiO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0Ij7wn5axIO2BtOumreuplOydtO2KuDwvYnV0dG9uPgogICAgPC9kaXY+CiAgICA8ZGl2IGlkPSJzZWxlY3RlZE9yZGVyVHlwZSIgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM5NGEzYjg7bWFyZ2luLWJvdHRvbTo4cHg7dGV4dC1hbGlnbjpjZW50ZXIiPuyEoO2DnTog7J2867CY67Cc7KO87IScPC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJib3JkZXI6MnB4IGRhc2hlZCAjNGFkZTgwO2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjIwcHg7dGV4dC1hbGlnbjpjZW50ZXI7Y3Vyc29yOnBvaW50ZXI7bWFyZ2luLWJvdHRvbToxMHB4O2JhY2tncm91bmQ6I2YwZmRmNCIgb25jbGljaz0iZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyRmlsZUlucHV0JykuY2xpY2soKSI+CiAgICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToyNHB4O21hcmdpbi1ib3R0b206NHB4Ij7wn5OOPC9kaXY+CiAgICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxM3B4O2NvbG9yOiMxNjY1MzQiPu2BtOumre2VmOyXrCDrsJzso7zshJwg7YyM7J28IOyEoO2DnSAoRXhjZWwpPC9kaXY+CiAgICAgIDxkaXYgaWQ9Im9yZGVyRmlsZU5hbWUiIHN0eWxlPSJmb250LXNpemU6MTJweDtjb2xvcjojNGFkZTgwO21hcmdpbi10b3A6NHB4O2ZvbnQtd2VpZ2h0OjYwMCI+PC9kaXY+CiAgICAgIDxpbnB1dCB0eXBlPSJmaWxlIiBpZD0ib3JkZXJGaWxlSW5wdXQiIGFjY2VwdD0iLnhsc3gsLnhscywuY3N2IiBzdHlsZT0iZGlzcGxheTpub25lIiBvbmNoYW5nZT0ib25PcmRlckZpbGVTZWxlY3QodGhpcykiPgogICAgPC9kaXY+CiAgICA8ZGl2IGlkPSJvcmRlclByZXZpZXciIHN0eWxlPSJkaXNwbGF5Om5vbmUiPgogICAgICA8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMnB4O21hcmdpbi1ib3R0b206MTBweCI+CiAgICAgICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO21hcmdpbi1ib3R0b206NHB4Ij48c3BhbiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6Izg4OCI+7LSdIOuwnOyjvOqxtOyImDwvc3Bhbj48c3BhbiBpZD0ib3JkZXJDb3VudCIgc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMEY2RTU2Ij4w6rG0PC9zcGFuPjwvZGl2PgogICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjttYXJnaW4tYm90dG9tOjRweCI+PHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiM4ODgiPuy0nSDsg4HtkojsiJg8L3NwYW4+PHNwYW4gaWQ9Im9yZGVyUHJvZHVjdENvdW50IiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMzYjgyZjYiPjDqsJw8L3NwYW4+PC9kaXY+CiAgICAgICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuIj48c3BhbiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6Izg4OCI+7LSdIOq4iOyVoTwvc3Bhbj48c3BhbiBpZD0ib3JkZXJUb3RhbEFtb3VudCIgc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojZGMyNjI2Ij7igqkwPC9zcGFuPjwvZGl2PgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBpZD0ib3JkZXJTdGF0dXMiIHN0eWxlPSJkaXNwbGF5Om5vbmU7cGFkZGluZzoxMHB4O2JvcmRlci1yYWRpdXM6OHB4O21hcmdpbi1ib3R0b206MTBweDtmb250LXNpemU6MTJweCI+PC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBidG4tZ3JlZW4iIG9uY2xpY2s9InN1Ym1pdE9yZGVyVXBsb2FkKCkiIGlkPSJidG5TdWJtaXRPcmRlciI+67Cc7KO8IOuTseuhnTwvYnV0dG9uPgogICAgPC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCI+CiAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO21hcmdpbi1ib3R0b206MTBweCI+CiAgICAgIDxkaXYgY2xhc3M9ImNhcmQtdGl0bGUiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjAiPvCfk4og7LWc6re8IOuwnOyjvCDrgrTsl608L2Rpdj4KICAgICAgPGJ1dHRvbiBvbmNsaWNrPSJpZihjb25maXJtKCfsoITssrQg67Cc7KO8IOuCtOyXreydhCDstIjquLDtmZTtlZjsi5zqsqDsirXri4jquYw/JykpcmVzZXRPcmRlcnMoKSIgc3R5bGU9InBhZGRpbmc6NHB4IDEwcHg7Ym9yZGVyOjFweCBzb2xpZCAjZmNhNWE1O2JvcmRlci1yYWRpdXM6NnB4O2JhY2tncm91bmQ6I2ZmZjtjb2xvcjojZGMyNjI2O2ZvbnQtc2l6ZToxMHB4O2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQiPuyghOyytCDstIjquLDtmZQ8L2J1dHRvbj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0icmVjZW50T3JkZXJzIj48c3BhbiBjbGFzcz0ibXV0ZWQiPuuwnOyjvCDrgrTsl63snbQg7JeG7Iq164uI64ukPC9zcGFuPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjwhLS0g4pWQ4pWQ4pWQIOyLpOyggSDtg60g4pWQ4pWQ4pWQIC0tPgo8ZGl2IGlkPSJ0YWItc3RhdHMiIGNsYXNzPSJoaWRkZW4iPgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBpZD0icGVyZkhlYWRlciIgY2xhc3M9ImNhcmQtdGl0bGUiPvCfk4og7YyQ66ek7ZiE7ZmpPC9kaXY+CiAgICA8ZGl2IGlkPSJwZXJmRGF0ZUZpbHRlciIgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6OHB4O2FsaWduLWl0ZW1zOmNlbnRlcjttYXJnaW4tYm90dG9tOjEycHg7ZmxleC13cmFwOndyYXAiPgogICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo0cHg7ZmxleDoxO21pbi13aWR0aDoxNDBweCI+CiAgICAgICAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM4ODg7d2hpdGUtc3BhY2U6bm93cmFwIj7si5zsnpHsnbw8L3NwYW4+CiAgICAgICAgPGlucHV0IHR5cGU9ImRhdGUiIGlkPSJwZXJmRnJvbSIgc3R5bGU9ImZsZXg6MTtwYWRkaW5nOjZweCA4cHg7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6NnB4O2ZvbnQtc2l6ZToxMnB4O2ZvbnQtZmFtaWx5OmluaGVyaXQiPgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NHB4O2ZsZXg6MTttaW4td2lkdGg6MTQwcHgiPgogICAgICAgIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojODg4O3doaXRlLXNwYWNlOm5vd3JhcCI+7KKF66OM7J28PC9zcGFuPgogICAgICAgIDxpbnB1dCB0eXBlPSJkYXRlIiBpZD0icGVyZlRvIiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6NnB4IDhweDtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czo2cHg7Zm9udC1zaXplOjEycHg7Zm9udC1mYW1pbHk6aW5oZXJpdCI+CiAgICAgIDwvZGl2PgogICAgICA8YnV0dG9uIG9uY2xpY2s9ImxvYWRQZXJmb3JtYW5jZSgpIiBzdHlsZT0icGFkZGluZzo2cHggMTZweDtiYWNrZ3JvdW5kOiMwRjZFNTY7Y29sb3I6I2ZmZjtib3JkZXI6bm9uZTtib3JkZXItcmFkaXVzOjZweDtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdDt3aGl0ZS1zcGFjZTpub3dyYXAiPuyhsO2ajDwvYnV0dG9uPgogICAgICA8YnV0dG9uIG9uY2xpY2s9InBlcmZRdWljaygnd2VlaycpIiBzdHlsZT0icGFkZGluZzo2cHggMTBweDtiYWNrZ3JvdW5kOiNmMWY1Zjk7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6NnB4O2ZvbnQtc2l6ZToxMXB4O2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQiPjHso7w8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBvbmNsaWNrPSJwZXJmUXVpY2soJ21vbnRoJykiIHN0eWxlPSJwYWRkaW5nOjZweCAxMHB4O2JhY2tncm91bmQ6I2YxZjVmOTtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czo2cHg7Zm9udC1zaXplOjExcHg7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdCI+MeqwnOyblDwvYnV0dG9uPgogICAgICA8YnV0dG9uIG9uY2xpY2s9InBlcmZRdWljaygnYWxsJykiIHN0eWxlPSJwYWRkaW5nOjZweCAxMHB4O2JhY2tncm91bmQ6I2YxZjVmOTtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czo2cHg7Zm9udC1zaXplOjExcHg7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdCI+7KCE7LK0PC9idXR0b24+CiAgICA8L2Rpdj4KICAgIDxkaXYgaWQ9Im15UGVyZm9ybWFuY2UiPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCjwhLS0g4pWQ4pWQ4pWQIOuCtCDshYDrn6wg7YOtICjqtIDrpqzsnpAv66eI7Iqk7YSwKSDilZDilZDilZAgLS0+CjxkaXYgaWQ9InRhYi1zZWxsZXJzIiBjbGFzcz0iaGlkZGVuIj4KICA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9ImNhcmQtdGl0bGUiPuuCtCDshYDrn6wg66qp66GdPC9kaXY+CiAgICA8ZGl2IGlkPSJteVNlbGxlckxpc3QiPjxzcGFuIGNsYXNzPSJtdXRlZCI+66Gc65Sp7KSRLi4uPC9zcGFuPjwvZGl2PgogIDwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0iY2FyZC10aXRsZSI+7IWA65+sIOuwnOyjvCDrgrTsl608L2Rpdj4KICAgIDxkaXYgaWQ9InNlbGxlck9yZGVycyI+PHNwYW4gY2xhc3M9Im11dGVkIj7roZzrlKnspJEuLi48L3NwYW4+PC9kaXY+CiAgPC9kaXY+CjwvZGl2PgoKPCEtLSDilZDilZDilZAg7KCE7LK0IOq0gOumrCDtg60gKOuniOyKpO2EsCkg4pWQ4pWQ4pWQIC0tPgo8ZGl2IGlkPSJ0YWItYWRtaW4iIGNsYXNzPSJoaWRkZW4iPgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0iY2FyZC10aXRsZSI+8J+TiiDqtIDrpqzsnpDrs4Qg7Iuk7KCBIO2YhO2ZqTwvZGl2PgogICAgPGRpdiBpZD0iYWRtaW5EYXNoYm9hcmQiPjxzcGFuIGNsYXNzPSJtdXRlZCI+66Gc65Sp7KSRLi4uPC9zcGFuPjwvZGl2PgogIDwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiPgogICAgPGRpdiBjbGFzcz0iY2FyZC10aXRsZSI+7KCE7LK0IOq0gOumrOyekDwvZGl2PgogICAgPGRpdiBpZD0iYWxsQWRtaW5MaXN0Ij48c3BhbiBjbGFzcz0ibXV0ZWQiPuuhnOuUqeykkS4uLjwvc3Bhbj48L2Rpdj4KICA8L2Rpdj4KICA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgIDxkaXYgY2xhc3M9ImNhcmQtdGl0bGUiPuyghOyytCDshYDrn6w8L2Rpdj4KICAgIDxkaXYgaWQ9ImFsbFNlbGxlckxpc3QiPjxzcGFuIGNsYXNzPSJtdXRlZCI+66Gc65Sp7KSRLi4uPC9zcGFuPjwvZGl2PgogIDwvZGl2Pgo8L2Rpdj4KCgoKPCEtLSDilZDilZDilZAg67Cp7Iah7J287KCVIO2DrSDilZDilZDilZAgLS0+CjxkaXYgaWQ9InRhYi1kYXNoIiBjbGFzcz0iaGlkZGVuIj4KICA8ZGl2IGlkPSJ1cGNvbWluZ0NhcmQiIGNsYXNzPSJjYXJkIiBzdHlsZT0iZGlzcGxheTpub25lO2JhY2tncm91bmQ6IzBmMTcyYTtjb2xvcjojZmZmO2JvcmRlcjpub25lIj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM5NGEzYjg7bGV0dGVyLXNwYWNpbmc6MXB4O21hcmdpbi1ib3R0b206OHB4Ij5VUENPTUlORyBCUk9BRENBU1Q8L2Rpdj4KICAgIDxkaXYgaWQ9InVwY29taW5nTGlzdCI+PC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBpZD0icGVuZGluZ1JlcXVlc3RzQ2FyZCIgY2xhc3M9ImNhcmQiIHN0eWxlPSJkaXNwbGF5Om5vbmU7Ym9yZGVyLWxlZnQ6NHB4IHNvbGlkICNmNTllMGIiPgogICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcjttYXJnaW4tYm90dG9tOjEwcHgiPgogICAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDAiPvCflJQg7Iug6recIOuwqeyGoSDsi6Dssq08L2Rpdj4KICAgICAgPHNwYW4gaWQ9InBlbmRpbmdDb3VudCIgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDEwcHg7Ym9yZGVyLXJhZGl1czoyMHB4O2JhY2tncm91bmQ6I2ZlZjNjNztjb2xvcjojOTI0MDBlO2ZvbnQtd2VpZ2h0OjcwMCI+MOqxtDwvc3Bhbj4KICAgIDwvZGl2PgogICAgPGRpdiBpZD0icGVuZGluZ0xpc3QiPjwvZGl2PgogIDwvZGl2PgogIDxkaXYgaWQ9Im15UmVxdWVzdHNDYXJkIiBjbGFzcz0iY2FyZCIgc3R5bGU9ImRpc3BsYXk6bm9uZSI+CiAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7bWFyZ2luLWJvdHRvbToxMHB4Ij7wn5OdIOuCtCDsi6Dssq0g7ZiE7ZmpPC9kaXY+CiAgICA8ZGl2IGlkPSJteVJlcXVlc3RzTGlzdCI+PC9kaXY+CiAgPC9kaXY+CiAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9InBhZGRpbmc6MTZweCI+CiAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO21hcmdpbi1ib3R0b206MTZweCI+CiAgICAgIDxidXR0b24gb25jbGljaz0iY2hhbmdlTW9udGgoLTEpIiBzdHlsZT0id2lkdGg6NDBweDtoZWlnaHQ6NDBweDtiYWNrZ3JvdW5kOiMwRjZFNTY7Y29sb3I6I2ZmZjtib3JkZXI6bm9uZTtib3JkZXItcmFkaXVzOjEwcHg7Y3Vyc29yOnBvaW50ZXI7Zm9udC1zaXplOjE2cHg7Zm9udC13ZWlnaHQ6NzAwIj7il4A8L2J1dHRvbj4KICAgICAgPHNwYW4gaWQ9ImNhbE1vbnRoTGFiZWwiIHN0eWxlPSJmb250LXNpemU6MjBweDtmb250LXdlaWdodDo4MDAiPjwvc3Bhbj4KICAgICAgPGJ1dHRvbiBvbmNsaWNrPSJjaGFuZ2VNb250aCgxKSIgc3R5bGU9IndpZHRoOjQwcHg7aGVpZ2h0OjQwcHg7YmFja2dyb3VuZDojMEY2RTU2O2NvbG9yOiNmZmY7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czoxMHB4O2N1cnNvcjpwb2ludGVyO2ZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMCI+4pa2PC9idXR0b24+CiAgICA8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6OHB4O21hcmdpbi1ib3R0b206MTJweDtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyIj4KICAgICAgPHNwYW4gc3R5bGU9ImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjRweDtmb250LXNpemU6MTFweCI+PHNwYW4gc3R5bGU9IndpZHRoOjEwcHg7aGVpZ2h0OjEwcHg7Ym9yZGVyLXJhZGl1czozcHg7YmFja2dyb3VuZDojZGMyNjI2O2Rpc3BsYXk6aW5saW5lLWJsb2NrIj48L3NwYW4+64yA6rWsPC9zcGFuPgogICAgICA8c3BhbiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NHB4O2ZvbnQtc2l6ZToxMXB4Ij48c3BhbiBzdHlsZT0id2lkdGg6MTBweDtoZWlnaHQ6MTBweDtib3JkZXItcmFkaXVzOjNweDtiYWNrZ3JvdW5kOiMzYjgyZjY7ZGlzcGxheTppbmxpbmUtYmxvY2siPjwvc3Bhbj7rqoXrj5k8L3NwYW4+CiAgICAgIDxzcGFuIHN0eWxlPSJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo0cHg7Zm9udC1zaXplOjExcHgiPjxzcGFuIHN0eWxlPSJ3aWR0aDoxMHB4O2hlaWdodDoxMHB4O2JvcmRlci1yYWRpdXM6M3B4O2JhY2tncm91bmQ6IzhiNWNmNjtkaXNwbGF5OmlubGluZS1ibG9jayI+PC9zcGFuPuqwleuPmTwvc3Bhbj4KICAgIDwvZGl2PgogICAgPGRpdiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNywxZnIpO21hcmdpbi1ib3R0b206NHB4Ij4KICAgICAgPGRpdiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNkYzI2MjY7cGFkZGluZzo4cHgiPuydvDwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7cGFkZGluZzo4cHgiPuyblDwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7cGFkZGluZzo4cHgiPu2ZlDwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7cGFkZGluZzo4cHgiPuyImDwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7cGFkZGluZzo4cHgiPuuqqTwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7cGFkZGluZzo4cHgiPuq4iDwvZGl2PgogICAgICA8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzNiODJmNjtwYWRkaW5nOjhweCI+7YagPC9kaXY+CiAgICA8L2Rpdj4KICAgIDxkaXYgaWQ9ImNhbEdyaWQiPjwvZGl2PgogIDwvZGl2PgogIDxkaXYgY2xhc3M9ImNhcmQiIGlkPSJzY2hlZHVsZVJlcXVlc3RDYXJkIiBzdHlsZT0iZGlzcGxheTpub25lO2JvcmRlci1sZWZ0OjRweCBzb2xpZCAjNGFkZTgwIj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMEY2RTU2O21hcmdpbi1ib3R0b206MTBweCIgaWQ9InNjaGVkdWxlRGF0ZSI+8J+ThSDrgqDsp5zrpbwg7ISg7YOd7ZWY7IS47JqUPC9kaXY+CiAgICA8ZGl2IGlkPSJzY2hlZHVsZUxpc3QiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE0cHgiPjwvZGl2PgogICAgPGRpdiBzdHlsZT0iYm9yZGVyLXRvcDoxcHggc29saWQgI2UyZThmMDtwYWRkaW5nLXRvcDoxNHB4O21hcmdpbi1ib3R0b206MTBweCI+CiAgICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMzM0MTU1O21hcmdpbi1ib3R0b206MTBweCI+4p6VIOyDiCDrsKnshqEg7Iug7LKtPC9kaXY+CiAgICA8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjhweCI+7Ja065SU7IScIOuwqeyGoe2VmOuCmOyalD88L2Rpdj4KICAgIDxkaXYgaWQ9InBsYWNlQnV0dG9ucyIgc3R5bGU9ImRpc3BsYXk6ZmxleDtnYXA6OHB4O21hcmdpbi1ib3R0b206MTZweCI+CiAgICAgIDxidXR0b24gb25jbGljaz0icGlja1BsYWNlKHRoaXMpIiBkYXRhLXBsYWNlPSLsiojtjbzrrLTsp4Qg64yA6rWs7KCQIiBkYXRhLWNvbG9yPSIjZGMyNjI2IiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6MTRweCA4cHg7Ym9yZGVyLXJhZGl1czoxMnB4O2JvcmRlcjoycHggc29saWQgI2RjMjYyNjtiYWNrZ3JvdW5kOiNmZWYyZjI7Y29sb3I6Izk5MWIxYjtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdCI+8J+UtDxicj7rjIDqtazsoJA8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBvbmNsaWNrPSJwaWNrUGxhY2UodGhpcykiIGRhdGEtcGxhY2U9IuyKiO2NvOustOynhCDrqoXrj5nsoJAiIGRhdGEtY29sb3I9IiMzYjgyZjYiIHN0eWxlPSJmbGV4OjE7cGFkZGluZzoxNHB4IDhweDtib3JkZXItcmFkaXVzOjEycHg7Ym9yZGVyOjJweCBzb2xpZCAjZTJlOGYwO2JhY2tncm91bmQ6I2ZmZjtjb2xvcjojNjQ3NDhiO2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0Ij7wn5S1PGJyPuuqheuPmeygkDwvYnV0dG9uPgogICAgICA8YnV0dG9uIG9uY2xpY2s9InBpY2tQbGFjZSh0aGlzKSIgZGF0YS1wbGFjZT0i7IqI7Y2866y07KeEIOqwleuPmeygkCIgZGF0YS1jb2xvcj0iIzhiNWNmNiIgc3R5bGU9ImZsZXg6MTtwYWRkaW5nOjE0cHggOHB4O2JvcmRlci1yYWRpdXM6MTJweDtib3JkZXI6MnB4IHNvbGlkICNlMmU4ZjA7YmFja2dyb3VuZDojZmZmO2NvbG9yOiM2NDc0OGI7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NjAwO2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQiPvCfn6M8YnI+6rCV64+Z7KCQPC9idXR0b24+CiAgICA8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjhweCI+67Cp7IahIOyLnOqwhDwvZGl2PgogICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NnB4O21hcmdpbi1ib3R0b206MTRweCI+CiAgICAgIDxkaXYgc3R5bGU9ImZsZXg6MTtkaXNwbGF5OmZsZXg7Ym9yZGVyOjJweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6MTBweDtvdmVyZmxvdzpoaWRkZW47YmFja2dyb3VuZDojZjhmYWZjIj4KICAgICAgICA8c2VsZWN0IGlkPSJzQVAxIiBzdHlsZT0icGFkZGluZzoxMHB4IDRweDtib3JkZXI6bm9uZTtmb250LXNpemU6MTVweDtmb250LXdlaWdodDo3MDA7Zm9udC1mYW1pbHk6aW5oZXJpdDt0ZXh0LWFsaWduOmNlbnRlcjtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50O2NvbG9yOiMzMzQxNTU7b3V0bGluZTpub25lOy13ZWJraXQtYXBwZWFyYW5jZTpub25lO2FwcGVhcmFuY2U6bm9uZTtjdXJzb3I6cG9pbnRlcjtmbGV4OjEiPjxvcHRpb24gdmFsdWU9IuyYpOyghCI+7Jik7KCEPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0i7Jik7ZuEIiBzZWxlY3RlZD7smKTtm4Q8L29wdGlvbj48L3NlbGVjdD4KICAgICAgICA8c2VsZWN0IGlkPSJzSDEiIHN0eWxlPSJwYWRkaW5nOjEwcHggNHB4O2JvcmRlcjpub25lO2ZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjcwMDtmb250LWZhbWlseTppbmhlcml0O3RleHQtYWxpZ246Y2VudGVyO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Y29sb3I6IzMzNDE1NTtvdXRsaW5lOm5vbmU7LXdlYmtpdC1hcHBlYXJhbmNlOm5vbmU7YXBwZWFyYW5jZTpub25lO2N1cnNvcjpwb2ludGVyO2ZsZXg6MSI+PG9wdGlvbiB2YWx1ZT0iMSI+MeyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjIiIHNlbGVjdGVkPjLsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIzIj4z7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iNCI+NOyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjUiPjXsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI2Ij427IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iNyI+N+yLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjgiPjjsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI5Ij457IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMTAiPjEw7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMTEiPjEx7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMTIiPjEy7IucPC9vcHRpb24+PC9zZWxlY3Q+CiAgICAgICAgPHNlbGVjdCBpZD0ic00xIiBzdHlsZT0icGFkZGluZzoxMHB4IDRweDtib3JkZXI6bm9uZTtmb250LXNpemU6MTVweDtmb250LXdlaWdodDo3MDA7Zm9udC1mYW1pbHk6aW5oZXJpdDt0ZXh0LWFsaWduOmNlbnRlcjtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50O2NvbG9yOiMzMzQxNTU7b3V0bGluZTpub25lOy13ZWJraXQtYXBwZWFyYW5jZTpub25lO2FwcGVhcmFuY2U6bm9uZTtjdXJzb3I6cG9pbnRlcjtmbGV4OjEiPjxvcHRpb24gdmFsdWU9IjAwIiBzZWxlY3RlZD4wMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjEwIj4xMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjIwIj4yMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjMwIj4zMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjQwIj40MOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjUwIj41MOu2hDwvb3B0aW9uPjwvc2VsZWN0PgogICAgICA8L2Rpdj4KICAgICAgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxOHB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojOTRhM2I4Ij5+PC9zcGFuPgogICAgICA8ZGl2IHN0eWxlPSJmbGV4OjE7ZGlzcGxheTpmbGV4O2JvcmRlcjoycHggc29saWQgI2UyZThmMDtib3JkZXItcmFkaXVzOjEwcHg7b3ZlcmZsb3c6aGlkZGVuO2JhY2tncm91bmQ6I2Y4ZmFmYyI+CiAgICAgICAgPHNlbGVjdCBpZD0ic0FQMiIgc3R5bGU9InBhZGRpbmc6MTBweCA0cHg7Ym9yZGVyOm5vbmU7Zm9udC1zaXplOjE1cHg7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtZmFtaWx5OmluaGVyaXQ7dGV4dC1hbGlnbjpjZW50ZXI7YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjojMzM0MTU1O291dGxpbmU6bm9uZTstd2Via2l0LWFwcGVhcmFuY2U6bm9uZTthcHBlYXJhbmNlOm5vbmU7Y3Vyc29yOnBvaW50ZXI7ZmxleDoxIj48b3B0aW9uIHZhbHVlPSLsmKTsoIQiPuyYpOyghDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IuyYpO2bhCIgc2VsZWN0ZWQ+7Jik7ZuEPC9vcHRpb24+PC9zZWxlY3Q+CiAgICAgICAgPHNlbGVjdCBpZD0ic0gyIiBzdHlsZT0icGFkZGluZzoxMHB4IDRweDtib3JkZXI6bm9uZTtmb250LXNpemU6MTVweDtmb250LXdlaWdodDo3MDA7Zm9udC1mYW1pbHk6aW5oZXJpdDt0ZXh0LWFsaWduOmNlbnRlcjtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50O2NvbG9yOiMzMzQxNTU7b3V0bGluZTpub25lOy13ZWJraXQtYXBwZWFyYW5jZTpub25lO2FwcGVhcmFuY2U6bm9uZTtjdXJzb3I6cG9pbnRlcjtmbGV4OjEiPjxvcHRpb24gdmFsdWU9IjEiPjHsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIyIj4y7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMyI+M+yLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjQiPjTsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI1Ij417IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iNiIgc2VsZWN0ZWQ+NuyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjciPjfsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI4Ij447IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iOSI+OeyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjEwIj4xMOyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjExIj4xMeyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjEyIj4xMuyLnDwvb3B0aW9uPjwvc2VsZWN0PgogICAgICAgIDxzZWxlY3QgaWQ9InNNMiIgc3R5bGU9InBhZGRpbmc6MTBweCA0cHg7Ym9yZGVyOm5vbmU7Zm9udC1zaXplOjE1cHg7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtZmFtaWx5OmluaGVyaXQ7dGV4dC1hbGlnbjpjZW50ZXI7YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjojMzM0MTU1O291dGxpbmU6bm9uZTstd2Via2l0LWFwcGVhcmFuY2U6bm9uZTthcHBlYXJhbmNlOm5vbmU7Y3Vyc29yOnBvaW50ZXI7ZmxleDoxIj48b3B0aW9uIHZhbHVlPSIwMCIgc2VsZWN0ZWQ+MDDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIxMCI+MTDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIyMCI+MjDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIzMCI+MzDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI0MCI+NDDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI1MCI+NTDrtoQ8L29wdGlvbj48L3NlbGVjdD4KICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KICAgIDxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjZweCI+66mU66qoPC9kaXY+CiAgICA8aW5wdXQgY2xhc3M9ImlucHV0IiBpZD0ic2NoZWRNZW1vIiBwbGFjZWhvbGRlcj0i7JqU7LKt7IKs7ZWtICjshKDtg50pIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxNHB4Ij4KICAgIDxidXR0b24gb25jbGljaz0ic3VibWl0U2NoZWR1bGUoKSIgc3R5bGU9IndpZHRoOjEwMCU7cGFkZGluZzoxNnB4O2JhY2tncm91bmQ6IzBGNkU1Njtjb2xvcjojZmZmO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6MTJweDtmb250LXNpemU6MTZweDtmb250LXdlaWdodDo3MDA7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdCI+8J+ToSDrsKnshqEg7Iug7LKtPC9idXR0b24+CiAgPC9kaXY+CiAgCjwvZGl2PgoKPC9kaXY+CjwvZGl2PgoKPHNjcmlwdD4KdmFyIGN1cnJlbnRVc2VyID0gbnVsbDsKdmFyIGNhY2hlZFByb2R1Y3RzID0gW107CnZhciBzY2FuQ2FjaGUgPSB7fTsKdmFyIGNhY2hlUmVhZHkgPSBmYWxzZTsKdmFyIHNlbGVjdGVkUGxhdGZvcm0gPSBudWxsOwp2YXIgY3VycmVudEJyb2FkY2FzdENvZGUgPSBudWxsOwp2YXIgaXNMaXZlID0gZmFsc2U7CnZhciBwcm9kdWN0cyA9IFtdOwp2YXIgbGl2ZVN0YXRzID0ge3Byb2R1Y3RzOnt9LG9yZGVyczowLHJldmVudWU6MH07Cgp2YXIgUExBVEZPUk1TID0gWwogIHtpZDonZ3JpcCcsbmFtZTon6re466a9Jyxjb2xvcjonI0ZGMkQ1NSd9LAogIHtpZDona3VsbWUnLG5hbWU6J+2BtOuplCcsY29sb3I6JyM1QjVGRUYnfSwKICB7aWQ6J3lvdXR1YmUnLG5hbWU6J+ycoO2KnOu4jCcsY29sb3I6JyNGRjAwMDAnfSwKICB7aWQ6J3Rpa3RvaycsbmFtZTon7Yux7YahJyxjb2xvcjonIzExMTExMSd9LAogIHtpZDonYmFuZCcsbmFtZTon67C065OcJyxjb2xvcjonIzA2Qzc1NSd9LAogIHtpZDonZXRjJyxuYW1lOifquLDtg4AnLGNvbG9yOicjODg4ODg4J30KXTsKCmZ1bmN0aW9uIGZtdChuKXtyZXR1cm4gTnVtYmVyKG58fDApLnRvTG9jYWxlU3RyaW5nKCdrby1LUicpfQoKd2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uKCl7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luUHcnKS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJyxmdW5jdGlvbihlKXtpZihlLmtleT09PSdFbnRlcicpZG9Mb2dpbkFjdGlvbigpfSk7CiAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3Ntal9sb2dpbicpOwp9CgpmdW5jdGlvbiBkb0xvZ2luQWN0aW9uKCl7CiAgdmFyIGlkPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dpbklkJykudmFsdWUudHJpbSgpOwogIHZhciBwdz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9naW5QdycpLnZhbHVlLnRyaW0oKTsKICBpZighaWR8fCFwdyl7c2hvd0xvZ2luRXJyKCfslYTsnbTrlJQv67mE67CA67KI7Zi466W8IOyeheugpe2VmOyEuOyalCcpO3JldHVybn0KICBzaG93TG9hZGluZygn66Gc6re47J24IOykkS4uLicpOwogIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihyKXtoaWRlTG9hZGluZygpOwogICAgaWYoci5vayl7Y3VycmVudFVzZXI9ci51c2VyO2VudGVyQXBwKCl9CiAgICBlbHNlIHNob3dMb2dpbkVycihyLm1zZykKICB9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oZSl7aGlkZUxvYWRpbmcoKTtzaG93TG9naW5FcnIoZS5tZXNzYWdlKX0pLmRvTG9naW4oaWQscHcpOwp9CmZ1bmN0aW9uIHNob3dMb2dpbkVycihtKXt2YXIgZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9naW5FcnInKTtlLnRleHRDb250ZW50PW07ZS5jbGFzc05hbWU9J2xvZ2luLWVyciBzaG93J30KZnVuY3Rpb24gc2hvd1JlZ1N0ZXAoc3RlcCl7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luRm9ybScpLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWdTdGVwMScpLnN0eWxlLmRpc3BsYXk9c3RlcD09PTE/J2Jsb2NrJzonbm9uZSc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlZ1N0ZXAyJykuc3R5bGUuZGlzcGxheT1zdGVwPT09Mj8nYmxvY2snOidub25lJzsKICBzaG93TG9naW5FcnIoJycpOwogIGlmKHN0ZXA9PT0xKXsKICAgIHNob3dMb2FkaW5nKCk7CiAgICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24obGlzdCl7aGlkZUxvYWRpbmcoKTsKICAgICAgdmFyIHNlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnQWRtaW5JZCcpOwogICAgICBzZWwuaW5uZXJIVE1MPSc8b3B0aW9uIHZhbHVlPSIiPuq0gOumrOyekCDshKDtg508L29wdGlvbj4nOwogICAgICBsaXN0LmZvckVhY2goZnVuY3Rpb24oYSl7c2VsLmlubmVySFRNTCs9JzxvcHRpb24gdmFsdWU9IicrYS5uYW1lKyciPicrYS5uYW1lKyhhLmNvbXBhbnk/JyAoJythLmNvbXBhbnkrJyknOicnKSsnPC9vcHRpb24+J30pOwogICAgfSkud2l0aEZhaWx1cmVIYW5kbGVyKGZ1bmN0aW9uKCl7aGlkZUxvYWRpbmcoKX0pLmdldEFkbWluTGlzdCgpOwogIH0KICBpZihzdGVwPT09Mil7CiAgICB2YXIgY2hlY2tzPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jaC1jaGVjaycpOwogICAgZm9yKHZhciBpPTA7aTxjaGVja3MubGVuZ3RoO2krKyl7CiAgICAgIGNoZWNrc1tpXS5vbmNoYW5nZT1mdW5jdGlvbigpewogICAgICAgIGlmKHRoaXMudmFsdWU9PT0n6riw7YOAJylkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnRXRjQ2hhbm5lbCcpLnN0eWxlLmRpc3BsYXk9dGhpcy5jaGVja2VkPydibG9jayc6J25vbmUnOwogICAgICAgIHZhciBsYWJlbD10aGlzLnBhcmVudE5vZGU7CiAgICAgICAgaWYodGhpcy5jaGVja2VkKXtsYWJlbC5zdHlsZS5ib3JkZXJDb2xvcj0nIzRhZGU4MCc7bGFiZWwuc3R5bGUuYmFja2dyb3VuZD0nI2YwZmRmNCc7bGFiZWwuc3R5bGUuY29sb3I9JyMxNjY1MzQnfQogICAgICAgIGVsc2V7bGFiZWwuc3R5bGUuYm9yZGVyQ29sb3I9JyNlMmU4ZjAnO2xhYmVsLnN0eWxlLmJhY2tncm91bmQ9JyNmZmYnO2xhYmVsLnN0eWxlLmNvbG9yPScjNjQ3NDhiJ30KICAgICAgfTsKICAgIH0KICAgIHZhciByYWRpb3M9ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnaW5wdXRbbmFtZT0iYXZnU2FsZXMiXScpOwogICAgZm9yKHZhciBpPTA7aTxyYWRpb3MubGVuZ3RoO2krKyl7CiAgICAgIHJhZGlvc1tpXS5vbmNoYW5nZT1mdW5jdGlvbigpewogICAgICAgIGZvcih2YXIgaj0wO2o8cmFkaW9zLmxlbmd0aDtqKyspe3ZhciBsYj1yYWRpb3Nbal0ucGFyZW50Tm9kZTtsYi5zdHlsZS5ib3JkZXJDb2xvcj0nI2UyZThmMCc7bGIuc3R5bGUuYmFja2dyb3VuZD0nI2ZmZic7bGIuc3R5bGUuY29sb3I9JyM2NDc0OGInfQogICAgICAgIHZhciBsYj10aGlzLnBhcmVudE5vZGU7bGIuc3R5bGUuYm9yZGVyQ29sb3I9JyM0YWRlODAnO2xiLnN0eWxlLmJhY2tncm91bmQ9JyNmMGZkZjQnO2xiLnN0eWxlLmNvbG9yPScjMTY2NTM0JzsKICAgICAgfTsKICAgIH0KICB9Cn0KZnVuY3Rpb24gc2hvd1JlZ0Zvcm0oKXtzaG93UmVnU3RlcCgxKX0KZnVuY3Rpb24gc2hvd0xvZ2luRm9ybSgpewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2dpbkZvcm0nKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnU3RlcDEnKS5zdHlsZS5kaXNwbGF5PSdub25lJzsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnU3RlcDInKS5zdHlsZS5kaXNwbGF5PSdub25lJzsKICBzaG93TG9naW5FcnIoJycpOwp9CmZ1bmN0aW9uIHZhbGlkYXRlUmVnRmllbGQoZWwsdHlwZSl7CiAgdmFyIHY9ZWwudmFsdWUudHJpbSgpOwogIGlmKHR5cGU9PT0naWQnKXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnSWRFcnInKS50ZXh0Q29udGVudD12Lmxlbmd0aD49Mz8nJzonM+yekCDsnbTsg4Eg7J6F66ClJztkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnSWRFcnInKS5jbGFzc05hbWU9di5sZW5ndGg+PTM/J3JlZy1oaW50IG9rJzoncmVnLWhpbnQnfQogIGlmKHR5cGU9PT0ncHcnKXt2YXIgb2s9di5sZW5ndGg+PTg7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlZ1B3RXJyJykudGV4dENvbnRlbnQ9b2s/J+KckyDsgqzsmqkg6rCA64qlJzonOOyekCDsnbTsg4Eg7J6F66ClJztkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnUHdFcnInKS5jbGFzc05hbWU9b2s/J3JlZy1oaW50IG9rJzoncmVnLWhpbnQnfQogIGlmKHR5cGU9PT0nZW1haWwnKXt2YXIgb2s9L15bXkBdK0BbXkBdK1wuW15AXSskLy50ZXN0KHYpO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWdFbWFpbEVycicpLnRleHRDb250ZW50PXY/b2s/J+KckyDsmKzrsJTrpbgg7ZiV7IudJzon7J2066mU7J28IO2YleyLneydhCDtmZXsnbjtlZjshLjsmpQnOicnO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWdFbWFpbEVycicpLmNsYXNzTmFtZT1vaz8ncmVnLWhpbnQgb2snOidyZWctaGludCd9Cn0KZnVuY3Rpb24gZm9ybWF0UGhvbmUoZWwpewogIHZhciB2PWVsLnZhbHVlLnJlcGxhY2UoL1teMC05XS9nLCcnKTsKICBpZih2Lmxlbmd0aD4zJiZ2Lmxlbmd0aDw9Nyl2PXYuc3Vic3RyaW5nKDAsMykrJy0nK3Yuc3Vic3RyaW5nKDMpOwogIGVsc2UgaWYodi5sZW5ndGg+Nyl2PXYuc3Vic3RyaW5nKDAsMykrJy0nK3Yuc3Vic3RyaW5nKDMsNykrJy0nK3Yuc3Vic3RyaW5nKDcsMTEpOwogIGVsLnZhbHVlPXY7CiAgdmFyIG9rPS9eMDEwLVxkezR9LVxkezR9JC8udGVzdCh2KTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnUGhvbmVFcnInKS50ZXh0Q29udGVudD12P29rPyfinJMnOifsmKzrsJTrpbgg67KI7Zi466W8IOyeheugpe2VmOyEuOyalCc6Jyc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlZ1Bob25lRXJyJykuY2xhc3NOYW1lPW9rPydyZWctaGludCBvayc6J3JlZy1oaW50JzsKfQp2YXIgcmVnVXNlcklkPScnOwpmdW5jdGlvbiBkb1JlZ1N0ZXAxKCl7CiAgdmFyIGQ9e2lkOmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWdJZCcpLnZhbHVlLnRyaW0oKSxwdzpkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnUHcnKS52YWx1ZS50cmltKCksCiAgICBuYW1lOmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWdOYW1lJykudmFsdWUudHJpbSgpLHBob25lOmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWdQaG9uZScpLnZhbHVlLnRyaW0oKSwKICAgIGVtYWlsOmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWdFbWFpbCcpLnZhbHVlLnRyaW0oKSwKICAgIGFkbWluSWQ6ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlZ0FkbWluSWQnKS52YWx1ZX07CiAgaWYoIWQuaWR8fGQuaWQubGVuZ3RoPDMpe3Nob3dMb2dpbkVycign7JWE7J2065SUIDPsnpAg7J207IOBIOyeheugpScpO3JldHVybn0KICBpZighZC5wd3x8ZC5wdy5sZW5ndGg8OCl7c2hvd0xvZ2luRXJyKCfruYTrsIDrsojtmLggOOyekCDsnbTsg4Eg7J6F66ClJyk7cmV0dXJufQogIGlmKCFkLm5hbWUpe3Nob3dMb2dpbkVycign7J2066aE7J2EIOyeheugpe2VmOyEuOyalCcpO3JldHVybn0KICBpZighL14wMTAtXGR7NH0tXGR7NH0kLy50ZXN0KGQucGhvbmUpKXtzaG93TG9naW5FcnIoJ+2ctOuMgO2PsCDrsojtmLjrpbwg7ZmV7J247ZWY7IS47JqUJyk7cmV0dXJufQogIGlmKCEvXlteQF0rQFteQF0rXC5bXkBdKyQvLnRlc3QoZC5lbWFpbCkpe3Nob3dMb2dpbkVycign7J2066mU7J28IO2YleyLneydhCDtmZXsnbjtlZjshLjsmpQnKTtyZXR1cm59CiAgaWYoIWQuYWRtaW5JZCl7c2hvd0xvZ2luRXJyKCfshozsho0g6rSA66as7J6Q66W8IOyEoO2Dne2VmOyEuOyalCcpO3JldHVybn0KICBzaG93TG9hZGluZygn6rCA7J6FIOyymOumrCDspJEuLi4nKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7aGlkZUxvYWRpbmcoKTsKICAgIGlmKHIub2spe3JlZ1VzZXJJZD1kLmlkO3Nob3dSZWdTdGVwKDIpfQogICAgZWxzZSBzaG93TG9naW5FcnIoci5tc2cpOwogIH0pLndpdGhGYWlsdXJlSGFuZGxlcihmdW5jdGlvbihlKXtoaWRlTG9hZGluZygpO3Nob3dMb2dpbkVycihlLm1lc3NhZ2UpfSkuZG9SZWdpc3RlcihkKTsKfQpmdW5jdGlvbiBkb1JlZ1N0ZXAyKCl7CiAgdmFyIGNoYW5uZWxzPVtdOwogIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jaC1jaGVjazpjaGVja2VkJykuZm9yRWFjaChmdW5jdGlvbihjKXtjaGFubmVscy5wdXNoKGMudmFsdWUpfSk7CiAgdmFyIGV0Yz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVnRXRjQ2hhbm5lbCcpLnZhbHVlLnRyaW0oKTsKICBpZihldGMpY2hhbm5lbHMucHVzaChldGMpOwogIHZhciBzYWxlc0VsPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W25hbWU9ImF2Z1NhbGVzIl06Y2hlY2tlZCcpOwogIHZhciBzYWxlcz1zYWxlc0VsP3NhbGVzRWwudmFsdWU6Jyc7CiAgaWYoY2hhbm5lbHMubGVuZ3RofHxzYWxlcyl7CiAgICBzaG93TG9hZGluZygn7KCA7J6lIOykkS4uLicpOwogICAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpe2hpZGVMb2FkaW5nKCk7c2hvd0xvZ2luRm9ybSgpO3Nob3dUb2FzdCgn7ZSE66Gc7ZWE7J20IOyggOyepeuQmOyXiOyKteuLiOuLpCEg66Gc6re47J247ZWY7IS47JqULicsJ3N1Y2Nlc3MnKQogICAgfSkud2l0aEZhaWx1cmVIYW5kbGVyKGZ1bmN0aW9uKGUpe2hpZGVMb2FkaW5nKCk7c2hvd0xvZ2luRm9ybSgpfSkudXBkYXRlU2VsbGVyUHJvZmlsZShyZWdVc2VySWQsY2hhbm5lbHMuam9pbignLCcpLHNhbGVzKTsKICB9ZWxzZXtzaG93TG9naW5Gb3JtKCl9Cn0KCi8vIOKVkOKVkOKVkCDshLjshZgg6rSA66asIOKVkOKVkOKVkApmdW5jdGlvbiByZXNldEFsbFN0YXRlKCl7CiAgY3VycmVudFVzZXI9bnVsbDtjYWNoZWRQcm9kdWN0cz1bXTtjYWNoZVJlYWR5PWZhbHNlO3NjYW5DYWNoZT17fTtzZWxlY3RlZFBsYXRmb3JtPW51bGw7CiAgY3VycmVudEJyb2FkY2FzdENvZGU9bnVsbDtpc0xpdmU9ZmFsc2U7cHJvZHVjdHM9W107CiAgbGl2ZVN0YXRzPXtwcm9kdWN0czp7fSxvcmRlcnM6MCxyZXZlbnVlOjB9OwogIHZhciBpZHM9WydiYXJjb2RlUmVzdWx0Jywnb3JkZXJQYWRBcmVhJywncmVjZW50T3JkZXJMaXN0JywnbXlTZWxsZXJMaXN0Jywnc2VsbGVyT3JkZXJzJywKICAgICdhZG1pbkRhc2hib2FyZCcsJ2FsbEFkbWluTGlzdCcsJ2FsbFNlbGxlckxpc3QnLCdwZXJmQ29udGVudCcsJ3VwY29taW5nTGlzdCcsJ3BlbmRpbmdMaXN0JywKICAgICdteVJlcXVlc3RzTGlzdCcsJ3NjaGVkdWxlTGlzdCcsJ2NhbEdyaWQnXTsKICBmb3IodmFyIGk9MDtpPGlkcy5sZW5ndGg7aSsrKXt2YXIgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWRzW2ldKTtpZihlbCllbC5pbm5lckhUTUw9Jyd9Cn0KZnVuY3Rpb24gZG9Mb2dvdXQoKXsKICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnc21qX2xvZ2luJyk7CiAgcmVzZXRBbGxTdGF0ZSgpOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluQXBwJykuc3R5bGUuZGlzcGxheT0nbm9uZSc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luU2NyZWVuJykuc3R5bGUuZGlzcGxheT0nZmxleCc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luSWQnKS52YWx1ZT0nJzsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9naW5QdycpLnZhbHVlPScnOwp9CgovLyDilZDilZDilZAg7JWxIOynhOyehSDilZDilZDilZAKZnVuY3Rpb24gZW50ZXJBcHAoKXsKaWYoIWN1cnJlbnRVc2VyfHwhY3VycmVudFVzZXIuaWQpe2RvTG9nb3V0KCk7cmV0dXJufQp2YXIgc2F2ZWRVc2VyPWN1cnJlbnRVc2VyOwpyZXNldEFsbFN0YXRlKCk7CmN1cnJlbnRVc2VyPXNhdmVkVXNlcjsKZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZ2luU2NyZWVuJykuc3R5bGUuZGlzcGxheT0nbm9uZSc7CmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluQXBwJykuc3R5bGUuZGlzcGxheT0nYmxvY2snOwp2YXIgdT1jdXJyZW50VXNlcjsKZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VzZXJOYW1lJykudGV4dENvbnRlbnQ9dS5uYW1lKycgJyt1LmlkOwpkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXNlclJvbGUnKS50ZXh0Q29udGVudD11LnJvbGU7CmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1c2VyQXZhdGFyJykudGV4dENvbnRlbnQ9KHUubmFtZXx8J1UnKS5jaGFyQXQoMCk7CmJ1aWxkVGFicygpOwpzd2l0Y2hUYWIoJ3NjYW4nKTsKcHJlbG9hZFByb2R1Y3RDYWNoZSgpOwp9CgpmdW5jdGlvbiBidWlsZFRhYnMoKXsKICB2YXIgcm9sZT1jdXJyZW50VXNlci5yb2xlOwogIHZhciBpc0FkbWluUm9sZT0ocm9sZT09PSfrp4jsiqTthLAnfHxyb2xlPT09J+u2gOuniOyKpO2EsCd8fHJvbGU9PT0n6rSA66as7J6QJyk7CiAgdmFyIHRhYnM9W3tpZDonc2NhbicsbGFiZWw6J+uwlOy9lOuTnCDsiqTsupQnfSx7aWQ6J29yZGVyJyxsYWJlbDppc0FkbWluUm9sZT8n67Cc7KO8IO2YhO2ZqSc6J+uwnOyjvCDrk7HroZ0nfSx7aWQ6J3N0YXRzJyxsYWJlbDon7YyQ66ek7ZiE7ZmpJ31dOwogIGlmKHJvbGU9PT0n6rSA66as7J6QJ3x8cm9sZT09PSfrp4jsiqTthLAnfHxyb2xlPT09J+u2gOuniOyKpO2EsCcpdGFicy5wdXNoKHtpZDonc2VsbGVycycsbGFiZWw6J+uCtCDshYDrn6wnfSk7CiAgaWYocm9sZT09PSfrp4jsiqTthLAnfHxyb2xlPT09J+u2gOuniOyKpO2EsCcpe3RhYnMucHVzaCh7aWQ6J2FkbWluJyxsYWJlbDon7KCE7LK0IOq0gOumrCd9KTt9CiAgdGFicy5wdXNoKHtpZDonZGFzaCcsbGFiZWw6J+uwqeyGoeydvOyglSd9KTsKICB2YXIgY29udGFpbmVyPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluVGFicycpOwogIGNvbnRhaW5lci5pbm5lckhUTUw9Jyc7CiAgdGFicy5mb3JFYWNoKGZ1bmN0aW9uKHQsaSl7CiAgICB2YXIgYnRuPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpOwogICAgYnRuLmNsYXNzTmFtZT0ndGFiJysoaT09PTA/JyBhY3RpdmUnOicnKTsKICAgIGJ0bi50ZXh0Q29udGVudD10LmxhYmVsOwogICAgYnRuLm9uY2xpY2s9ZnVuY3Rpb24oKXtzd2l0Y2hUYWIodC5pZCl9OwogICAgYnRuLnNldEF0dHJpYnV0ZSgnZGF0YS10YWInLHQuaWQpOwogICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ0bik7CiAgfSk7Cn0KCmZ1bmN0aW9uIHN3aXRjaFRhYihuYW1lKXsKaWYoIWN1cnJlbnRVc2VyKXJldHVybjsKdmFyIGFsbFRhYnM9WydzY2FuJywnb3JkZXInLCdzdGF0cycsJ3NlbGxlcnMnLCdhZG1pbicsJ3Byb3Bvc2FscycsJ2Rhc2gnXTsKYWxsVGFicy5mb3JFYWNoKGZ1bmN0aW9uKHQpewp2YXIgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RhYi0nK3QpOwppZihlbCllbC5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLHQhPT1uYW1lKTsKfSk7CmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy50YWInKS5mb3JFYWNoKGZ1bmN0aW9uKGIpe2IuY2xhc3NMaXN0LnRvZ2dsZSgnYWN0aXZlJyxiLmdldEF0dHJpYnV0ZSgnZGF0YS10YWInKT09PW5hbWUpfSk7CmlmKG5hbWU9PT0nc3RhdHMnKXtsb2FkUGVyZm9ybWFuY2UoKX0KaWYobmFtZT09PSdvcmRlcicpe2xvYWRSZWNlbnRPcmRlcnMoKTsKdmFyIGlhPWN1cnJlbnRVc2VyJiYoY3VycmVudFVzZXIucm9sZT09PSfrp4jsiqTthLAnfHxjdXJyZW50VXNlci5yb2xlPT09J+u2gOuniOyKpO2EsCd8fGN1cnJlbnRVc2VyLnJvbGU9PT0n6rSA66as7J6QJyk7CmlmKGlhKXt2YXIgZHQ9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RhYi1vcmRlciAuY2FyZC10aXRsZScpO2lmKGR0KWR0LnRleHRDb250ZW50PSfwn5OKIOuwnOyjvCDqtIDrpqwnfQp9CmlmKG5hbWU9PT0nc2VsbGVycycpbG9hZE15U2VsbGVyc1RhYigpOwppZihuYW1lPT09J2FkbWluJylsb2FkQWxsQWRtaW5zVGFiKCk7CmlmKG5hbWU9PT0nZGFzaCcpe2luaXRDYWxlbmRhcigpO2xvYWRTY2hlZHVsZURhdGEoKX0KaWYobmFtZT09PSdzY2FuJyl7dmFyIGJpPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXJjb2RlSW5wdXQnKTtpZihiaSlzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7YmkuZm9jdXMoKX0sMjAwKX0KfQoKLy8g4pWQ4pWQ4pWQIO2UjOueq+2PvCDilZDilZDilZAKZnVuY3Rpb24gcmVuZGVyUGxhdGZvcm1zKCl7CiAgdmFyIGh0bWw9Jyc7CiAgZm9yKHZhciBpPTA7aTxQTEFURk9STVMubGVuZ3RoO2krKyl7CiAgICB2YXIgcD1QTEFURk9STVNbaV07CiAgICBodG1sKz0nPGRpdiBjbGFzcz0icGxhdCIgZGF0YS1pZD0iJytwLmlkKyciIG9uY2xpY2s9InNlbGVjdFBsYXRmb3JtKFwnJytwLmlkKydcJykiIHN0eWxlPSJjb2xvcjonK3AuY29sb3IrJyI+JytwLm5hbWUrJzwvZGl2Pic7CiAgfQogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF0Zm9ybUdyaWQnKS5pbm5lckhUTUw9aHRtbDsKfQpmdW5jdGlvbiBzZWxlY3RQbGF0Zm9ybShpZCl7CiAgc2VsZWN0ZWRQbGF0Zm9ybT1pZDsKICB2YXIgZWxzPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5wbGF0Jyk7CiAgZm9yKHZhciBpPTA7aTxlbHMubGVuZ3RoO2krKyl7CiAgICB2YXIgaXNTPWVsc1tpXS5kYXRhc2V0LmlkPT09aWQ7CiAgICB2YXIgcDtmb3IodmFyIGo9MDtqPFBMQVRGT1JNUy5sZW5ndGg7aisrKXtpZihQTEFURk9STVNbal0uaWQ9PT1lbHNbaV0uZGF0YXNldC5pZClwPVBMQVRGT1JNU1tqXX0KICAgIGVsc1tpXS5jbGFzc0xpc3QudG9nZ2xlKCdzZWwnLGlzUyk7CiAgICBlbHNbaV0uc3R5bGUuYm9yZGVyQ29sb3I9aXNTP3AuY29sb3I6JyNkZGQnOwogICAgZWxzW2ldLnN0eWxlLmJhY2tncm91bmQ9aXNTP3AuY29sb3IrJzEyJzonI2ZmZic7CiAgfQogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdldGNNZW1vV3JhcCcpLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsaWQhPT0nZXRjJyk7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0blN0YXJ0JykuZGlzYWJsZWQ9ZmFsc2U7Cn0KCi8vIOKVkOKVkOKVkCDsg4Htkogg4pWQ4pWQ4pWQCmZ1bmN0aW9uIGxvYWRQcm9kdWN0cygpewogIHNob3dMb2FkaW5nKCk7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKGRhdGEpe2hpZGVMb2FkaW5nKCk7cHJvZHVjdHM9ZGF0YXx8W107bG9hZFByb2R1Y3REcm9wZG93bigpfSkuZ2V0UHJvZHVjdExpc3QoKTsKfQpmdW5jdGlvbiBsb2FkUHJvZHVjdERyb3Bkb3duKCl7CiAgdmFyIHNlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJQcm9kdWN0Jyk7CiAgdmFyIGh0bWw9JzxvcHRpb24gdmFsdWU9IiI+7IOB7ZKI7J2EIOyEoO2Dne2VmOyEuOyalDwvb3B0aW9uPic7CiAgZm9yKHZhciBpPTA7aTxwcm9kdWN0cy5sZW5ndGg7aSsrKXt2YXIgcD1wcm9kdWN0c1tpXTtodG1sKz0nPG9wdGlvbiB2YWx1ZT0iJytwLmNvZGUrJyI+WycrcC5jb2RlKyddICcrcC5uYW1lKycgKOyerOqzoCAnK3AudG90YWxTdG9jaysnKTwvb3B0aW9uPid9CiAgc2VsLmlubmVySFRNTD1odG1sOwp9CmZ1bmN0aW9uIG9uUHJvZHVjdFNlbGVjdCgpewogIHZhciBjb2RlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclByb2R1Y3QnKS52YWx1ZTsKICB2YXIgaW5mbz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJQcm9kdWN0SW5mbycpOwogIGlmKCFjb2RlKXtpbmZvLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO3VwZGF0ZU9yZGVyQW1vdW50KCk7cmV0dXJufQogIHZhciBwPW51bGw7Zm9yKHZhciBpPTA7aTxwcm9kdWN0cy5sZW5ndGg7aSsrKXtpZihTdHJpbmcocHJvZHVjdHNbaV0uY29kZSk9PT1jb2RlKXA9cHJvZHVjdHNbaV19CiAgaWYoIXApe2luZm8uY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7cmV0dXJufQogIGluZm8uY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyUHJpY2UnKS50ZXh0Q29udGVudD0n4oKpJytmbXQocC5zZWxsUHJpY2UpOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclN0b2NrJykudGV4dENvbnRlbnQ9cC50b3RhbFN0b2NrKyfqsJwnOwogIHVwZGF0ZU9yZGVyQW1vdW50KCk7Cn0KZnVuY3Rpb24gdXBkYXRlT3JkZXJBbW91bnQoKXsKICB2YXIgY29kZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJQcm9kdWN0JykudmFsdWU7CiAgdmFyIHF0eT1wYXJzZUludChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJRdHknKS52YWx1ZSl8fDA7CiAgdmFyIHA9bnVsbDtmb3IodmFyIGk9MDtpPHByb2R1Y3RzLmxlbmd0aDtpKyspe2lmKFN0cmluZyhwcm9kdWN0c1tpXS5jb2RlKT09PWNvZGUpcD1wcm9kdWN0c1tpXX0KICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJBbW91bnQnKS50ZXh0Q29udGVudD0n4oKpJytmbXQocD9wLnNlbGxQcmljZSpxdHk6MCk7Cn0KCi8vIOKVkOKVkOKVkCDrsKnshqEg4pWQ4pWQ4pWQCmZ1bmN0aW9uIGRvU3RhcnRCcm9hZGNhc3QoKXsKICB2YXIgY29kZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmNDb2RlJykudmFsdWU7CiAgdmFyIHBsYXRmb3JtPW51bGw7Zm9yKHZhciBpPTA7aTxQTEFURk9STVMubGVuZ3RoO2krKyl7aWYoUExBVEZPUk1TW2ldLmlkPT09c2VsZWN0ZWRQbGF0Zm9ybSlwbGF0Zm9ybT1QTEFURk9STVNbaV19CiAgdmFyIG1lbW89c2VsZWN0ZWRQbGF0Zm9ybT09PSdldGMnP2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdldGNNZW1vJykudmFsdWU6Jyc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0blN0YXJ0JykuZGlzYWJsZWQ9dHJ1ZTtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuU3RhcnQnKS50ZXh0Q29udGVudD0n7Iuc7J6RIOykkS4uLic7CiAgc2hvd0xvYWRpbmcoKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24oYmNDb2RlKXtoaWRlTG9hZGluZygpOwogICAgY3VycmVudEJyb2FkY2FzdENvZGU9YmNDb2RlO2lzTGl2ZT10cnVlO2xpdmVTdGF0cz17cHJvZHVjdHM6e30sb3JkZXJzOjAscmV2ZW51ZTowfTsKICAgIGNsb3NlQnJvYWRjYXN0TW9kYWwoKTsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5Ccm9hZGNhc3RGbG9hdCcpLmlubmVySFRNTD0n4o+5IOuwqeyGoSDsooXro4wgKCcrYmNDb2RlKycpJzsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5Ccm9hZGNhc3RGbG9hdCcpLmNsYXNzTGlzdC5hZGQoJ2xpdmUnKTsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlQ29kZScpLnRleHRDb250ZW50PWJjQ29kZTsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXZlUGxhdGZvcm0nKS50ZXh0Q29udGVudD1wbGF0Zm9ybS5uYW1lKycgwrcgJytjdXJyZW50VXNlci5uYW1lOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpdmVUaW1lJykudGV4dENvbnRlbnQ9bmV3IERhdGUoKS50b0xvY2FsZVRpbWVTdHJpbmcoJ2tvLUtSJyx7aG91cjonMi1kaWdpdCcsbWludXRlOicyLWRpZ2l0J30pKycgfic7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NhblJlc3VsdCcpLmlubmVySFRNTD0nJzsKICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmFyY29kZUlucHV0JykuZm9jdXMoKX0sMzAwKTsKICB9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oZSl7aGlkZUxvYWRpbmcoKTsKICAgIHNob3dUb2FzdChlLCdlcnJvcicpO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5TdGFydCcpLmRpc2FibGVkPWZhbHNlO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5TdGFydCcpLnRleHRDb250ZW50PSfrsKnshqEg7Iuc7J6RJzsKICB9KS5zdGFydEJyb2FkY2FzdCh7Y29kZTpjb2RlLHNlbGxlcjpjdXJyZW50VXNlci5uYW1lLHBsYXRmb3JtOnBsYXRmb3JtLm5hbWUsbWVtbzptZW1vfSk7Cn0KZnVuY3Rpb24gZG9FbmRCcm9hZGNhc3QoKXsKICBpZighY29uZmlybSgn67Cp7IahIOyiheujjD8nKSlyZXR1cm47CiAgc2hvd0xvYWRpbmcoKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24oKXtoaWRlTG9hZGluZygpOwogICAgaXNMaXZlPWZhbHNlO2N1cnJlbnRCcm9hZGNhc3RDb2RlPW51bGw7c2VsZWN0ZWRQbGF0Zm9ybT1udWxsOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bkJyb2FkY2FzdEZsb2F0JykuaW5uZXJIVE1MPSfwn5S0IOuwqeyGoSDsi5zsnpEnOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bkJyb2FkY2FzdEZsb2F0JykuY2xhc3NMaXN0LnJlbW92ZSgnbGl2ZScpOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0blN0YXJ0JykuZGlzYWJsZWQ9dHJ1ZTtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuU3RhcnQnKS50ZXh0Q29udGVudD0n67Cp7IahIOyLnOyekSc7CiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcucGxhdCcpLmZvckVhY2goZnVuY3Rpb24oZSl7ZS5jbGFzc0xpc3QucmVtb3ZlKCdzZWwnKTtlLnN0eWxlLmJvcmRlckNvbG9yPScjZGRkJztlLnN0eWxlLmJhY2tncm91bmQ9JyNmZmYnfSk7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmNDb2RlJykudmFsdWU9Jyc7bG9hZFJlY2VudEJyb2FkY2FzdHMoKTsKICB9KS5lbmRCcm9hZGNhc3QoY3VycmVudEJyb2FkY2FzdENvZGUpOwp9CgovLyDilZDilZDilZAg67CU7L2U65OcIOyKpOy6lCAoMuy7rOufvCArIOuhnOy7rOy6kOyLnCkg4pWQ4pWQ4pWQCnZhciBsYXN0U2Nhbm5lZFByb2R1Y3Q9bnVsbDsKdmFyIHNjYW5IaXN0b3J5TGlzdD1bXTsKCmZ1bmN0aW9uIHByZWxvYWRQcm9kdWN0Q2FjaGUoKXsKICB2YXIgY3M9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhY2hlU3RhdHVzJyk7CiAgaWYoY3MpY3MuaW5uZXJIVE1MPSc8c3BhbiBzdHlsZT0iY29sb3I6I2Y1OWUwYiI+66Gc65Sp7KSRLi4uPC9zcGFuPic7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKGRhdGEpewogICAgY2FjaGVkUHJvZHVjdHM9ZGF0YXx8W107CiAgICBjYWNoZVJlYWR5PXRydWU7CiAgICBpZihjcyljcy5pbm5lckhUTUw9JzxzcGFuIHN0eWxlPSJjb2xvcjojNGFkZTgwIj7spIDruYTsmYTro4w8L3NwYW4+JzsKICB9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oKXsKICAgIGlmKGNzKWNzLmlubmVySFRNTD0nPHNwYW4gc3R5bGU9ImNvbG9yOiNkYzI2MjYiPuuhnOuUqeyLpO2MqDwvc3Bhbj4gPHNwYW4gb25jbGljaz0icHJlbG9hZFByb2R1Y3RDYWNoZSgpIiBzdHlsZT0iY3Vyc29yOnBvaW50ZXI7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZSI+7J6s7Iuc64+EPC9zcGFuPic7CiAgfSkuZ2V0UHJvZHVjdExpc3QoKTsKfQoKZnVuY3Rpb24gbG9jYWxGaW5kQnlCYXJjb2RlKGJjKXsKICB2YXIgYj1TdHJpbmcoYmMpLnRyaW0oKS5yZXBsYWNlKC9cLjArJC8sJycpLnJlcGxhY2UoL1xzL2csJycpOwogIGZvcih2YXIgaT0wO2k8Y2FjaGVkUHJvZHVjdHMubGVuZ3RoO2krKyl7CiAgICB2YXIgcGJjPVN0cmluZyhjYWNoZWRQcm9kdWN0c1tpXS5iYXJjb2RlfHwnJykudHJpbSgpLnJlcGxhY2UoL1wuMCskLywnJykucmVwbGFjZSgvXHMvZywnJyk7CiAgICBpZihwYmM9PT1iKXJldHVybiBjYWNoZWRQcm9kdWN0c1tpXTsKICB9CiAgcmV0dXJuIG51bGw7Cn0KCmZ1bmN0aW9uIGRvU2NhbigpewogIHZhciBiYXJjb2RlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXJjb2RlSW5wdXQnKS52YWx1ZS50cmltKCk7aWYoIWJhcmNvZGUpcmV0dXJuOwogIGlmKGNhY2hlUmVhZHkpewogICAgdmFyIHByb2R1Y3Q9bG9jYWxGaW5kQnlCYXJjb2RlKGJhcmNvZGUpOwogICAgc2hvd1NjYW5SZXN1bHQocHJvZHVjdCwgYmFyY29kZSk7CiAgfSBlbHNlIHsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY2FuTWFpbkNvbnRlbnQnKS5pbm5lckhUTUw9JzxkaXYgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO3BhZGRpbmc6MzBweDtjb2xvcjojODg4Ij7sg4Htkogg642w7J207YSwIOuhnOuUqSDspJEuLi48L2Rpdj4nOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JhcmNvZGVJbnB1dCcpLnZhbHVlPScnOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JhcmNvZGVJbnB1dCcpLmZvY3VzKCk7CiAgfQp9CgpmdW5jdGlvbiBzaG93U2NhblJlc3VsdChwcm9kdWN0LCBiYXJjb2RlKXsKICBpZighcHJvZHVjdCl7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2Nhbk1haW5Db250ZW50JykuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJlbXB0eS1zY2FuIj48ZGl2IGNsYXNzPSJpY29uIj7inYw8L2Rpdj48ZGl2IGNsYXNzPSJtc2ciPuyDge2SiOydhCDssL7snYQg7IiYIOyXhuyKteuLiOuLpDxicj48c3BhbiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6I2NiZDVlMSI+67CU7L2U65OcOiAnK2JhcmNvZGUrJzwvc3Bhbj48L2Rpdj48L2Rpdj4nOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpZGVTdG9jaycpLnRleHRDb250ZW50PSctJzsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaWRlU2FsZScpLnRleHRDb250ZW50PSctJzsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaWRlU3VwcGx5JykudGV4dENvbnRlbnQ9Jy0nOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpZGVNYXJnaW4nKS50ZXh0Q29udGVudD0nLSc7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2lkZVByb2ZpdCcpLnRleHRDb250ZW50PScnOwogIH0gZWxzZSB7CiAgICBsYXN0U2Nhbm5lZFByb2R1Y3Q9cHJvZHVjdDsKICAgIGxpdmVTdGF0cy5wcm9kdWN0c1twcm9kdWN0LmNvZGVdPXRydWU7CiAgICB1cGRhdGVTaWRlYmFyKHByb2R1Y3QpOwogICAgdXBkYXRlTWFpbkNvbnRlbnQocHJvZHVjdCk7CiAgICBhZGRTY2FuSGlzdG9yeShwcm9kdWN0KTsKICB9CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JhcmNvZGVJbnB1dCcpLnZhbHVlPScnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXJjb2RlSW5wdXQnKS5mb2N1cygpOwp9CgpmdW5jdGlvbiB1cGRhdGVTaWRlYmFyKHApewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaWRlU3RvY2snKS50ZXh0Q29udGVudD1wLnRvdGFsU3RvY2s7CiAgdmFyIHNkPScnOwogIGlmKHAuc3RvY2tNdWppbj4wKXNkKz0n66y07KeEOicrcC5zdG9ja011amluKycgJzsKICBpZihwLnN0b2NrMT4wKXNkKz0n7JOw66as67CxOicrcC5zdG9jazErJyAnOwogIGlmKHAuc3RvY2syPjApc2QrPSfqsbDrnpjsspgyOicrcC5zdG9jazIrJyAnOwogIGlmKHAuc3RvY2szPjApc2QrPSfqsbDrnpjsspgzOicrcC5zdG9jazM7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0b2NrRGV0YWlsJykudGV4dENvbnRlbnQ9c2R8fCcnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaWRlU2FsZScpLnRleHRDb250ZW50PWZtdChwLnNlbGxQcmljZSkrJ+ybkCc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpZGVTdXBwbHknKS50ZXh0Q29udGVudD1mbXQocC5zdXBwbHlQcmljZSkrJ+ybkCc7CiAgdmFyIG1hcmdpbj1wLnNlbGxQcmljZT4wP01hdGgucm91bmQoKHAuc2VsbFByaWNlLXAuc3VwcGx5UHJpY2UpL3Auc2VsbFByaWNlKjEwMCk6MDsKICB2YXIgcHJvZml0PXAuc2VsbFByaWNlLXAuc3VwcGx5UHJpY2U7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpZGVNYXJnaW4nKS50ZXh0Q29udGVudD1tYXJnaW4rJyUgKCcrZm10KHByb2ZpdCkrJ+ybkCknOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaWRlUHJvZml0JykudGV4dENvbnRlbnQ9J+qwnOuLuSDsnbTsnbUgJytmbXQocHJvZml0KSsn7JuQJzsKICBpZihwLnRvdGFsU3RvY2s8PTUpe2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaWRlU3RvY2snKS5zdHlsZS5jb2xvcj0nI2Y4NzE3MSd9CiAgZWxzZXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2lkZVN0b2NrJykuc3R5bGUuY29sb3I9JyM0YWRlODAnfQogIHNob3dPcmRlclBhZEZvcm0ocCk7Cn0KCmZ1bmN0aW9uIHVwZGF0ZU1haW5Db250ZW50KHApewogIHZhciBzdG9ja0NsYXNzPXAudG90YWxTdG9jazw9NT8nJzonb2snOwogIHZhciBzdG9ja0xhYmVsPXAudG90YWxTdG9jazw9NT8n7J6s6rOgIOu2gOyhsSc6J+yerOqzoCDstqnrtoQnOwogIHZhciBxPWVuY29kZVVSSUNvbXBvbmVudChwLm5hbWUpOwogIHZhciBtYXJnaW49cC5zZWxsUHJpY2UtcC5zdXBwbHlQcmljZTsKICB2YXIgbWFyZ2luUmF0ZT1wLnNlbGxQcmljZT4wP01hdGgucm91bmQobWFyZ2luL3Auc2VsbFByaWNlKjEwMCk6MDsKCiAgLy8g4pWQ4pWQ4pWQIDHri6jqs4Q6IOymieyLnCDtkZzsi5wgKDAuMDHstIgpIOKVkOKVkOKVkAogIHZhciBodG1sPSc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7Z2FwOjhweDttYXJnaW4tYm90dG9tOjEwcHgiPicKICAgICsnPGEgaHJlZj0iaHR0cHM6Ly9zZWFyY2guc2hvcHBpbmcubmF2ZXIuY29tL3NlYXJjaC9hbGw/cXVlcnk9JytxKyciIHRhcmdldD0iX2JsYW5rIiBzdHlsZT0iZmxleDoxO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtnYXA6NnB4O3BhZGRpbmc6MTJweDtiYWNrZ3JvdW5kOiMwM2M3NWE7Y29sb3I6I2ZmZjtib3JkZXItcmFkaXVzOjEwcHg7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwO3RleHQtZGVjb3JhdGlvbjpub25lIj5OIOuEpOydtOuyhCDsh7ztlZE8L2E+JwogICAgKyc8YSBocmVmPSJodHRwczovL3d3dy5jb3VwYW5nLmNvbS9ucC9zZWFyY2g/cT0nK3ErJyIgdGFyZ2V0PSJfYmxhbmsiIHN0eWxlPSJmbGV4OjE7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2dhcDo2cHg7cGFkZGluZzoxMnB4O2JhY2tncm91bmQ6I2RjMjYyNjtjb2xvcjojZmZmO2JvcmRlci1yYWRpdXM6MTBweDtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7dGV4dC1kZWNvcmF0aW9uOm5vbmUiPkMg7L+g7YyhPC9hPjwvZGl2Pic7CiAgaHRtbCs9JzxkaXYgY2xhc3M9InByb2R1Y3QtaGVhZGVyIj48ZGl2PjxoMj4nKyhwLmNvZGU/J1snK3AuY29kZSsnXSAnOicnKStwLm5hbWUrJzwvaDI+PGRpdiBjbGFzcz0ic3ViIj58ICcrcC5iYXJjb2RlKyc8L2Rpdj48L2Rpdj4nCiAgICArJzxkaXYgY2xhc3M9InN0b2NrLWJhZGdlICcrc3RvY2tDbGFzcysnIj48ZGl2IGNsYXNzPSJudW0iPicrcC50b3RhbFN0b2NrKyc8L2Rpdj48ZGl2IGNsYXNzPSJsYWJlbCI+JytzdG9ja0xhYmVsKyc8L2Rpdj48L2Rpdj48L2Rpdj4nOwogIGh0bWwrPSc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyIDFmcjtnYXA6NnB4O21hcmdpbi1ib3R0b206MTZweCI+JwogICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMGZkZjQ7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPu2MkOunpOqwgDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMEY2RTU2Ij7igqknK2ZtdChwLnNlbGxQcmljZSkrJzwvZGl2PjwvZGl2PicKICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmFmNWZmO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4Ij7qs7XquInqsIA8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTZweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzdjM2FlZCI+4oKpJytmbXQocC5zdXBwbHlQcmljZSkrJzwvZGl2PjwvZGl2PicKICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmVmY2U4O2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4Ij7rp4jsp4Q8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTZweDtmb250LXdlaWdodDo3MDA7Y29sb3I6I2Y1OWUwYiI+4oKpJytmbXQobWFyZ2luKSsnPC9kaXY+PC9kaXY+JwogICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMWY1Zjk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPuuniOynhOycqDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjonKyhtYXJnaW5SYXRlPj0zMD8nIzBGNkU1Nic6bWFyZ2luUmF0ZT49MTU/JyNmNTllMGInOicjZGMyNjI2JykrJyI+JyttYXJnaW5SYXRlKyclPC9kaXY+PC9kaXY+JwogICAgKyc8L2Rpdj4nOwoKICAvLyDilZDilZDilZAgMuuLqOqzhDog7KeA7JewIOuhnOuUqSDsmIHsl60gKHNrZWxldG9uKSDilZDilZDilZAKICBodG1sKz0nPGRpdiBjbGFzcz0iYWktc2VjdGlvbiI+PGgzIHN0eWxlPSJtYXJnaW4tYm90dG9tOjAiPvCfpJYgQUkg67aE7ISdPC9oMz4nCiAgICArJzxkaXYgaWQ9ImFpSGVhZGxpbmUiIHN0eWxlPSJmb250LXNpemU6MTZweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzBGNkU1NjttYXJnaW46OHB4IDAiPjwvZGl2PicKICAgICsnPGJ1dHRvbiBvbmNsaWNrPSJkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcJ2FpRGV0YWlsXCcpLnN0eWxlLmRpc3BsYXk9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCdhaURldGFpbFwnKS5zdHlsZS5kaXNwbGF5PT09XCdub25lXCc/XCdibG9ja1wnOlwnbm9uZVwnO3RoaXMudGV4dENvbnRlbnQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCdhaURldGFpbFwnKS5zdHlsZS5kaXNwbGF5PT09XCdub25lXCc/XCfilrwg7IOB7IS4IOu2hOyEnSDrs7TquLBcJzpcJ+KWsiDsoJHquLBcJyIgc3R5bGU9ImJhY2tncm91bmQ6bm9uZTtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo0cHggMTJweDtmb250LXNpemU6MTFweDtjb2xvcjojNjQ3NDhiO2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQ7bWFyZ2luLWJvdHRvbTo4cHgiPuKWvCDsg4HshLgg67aE7ISdIOuztOq4sDwvYnV0dG9uPicKICAgICsnPGRpdiBpZD0iYWlEZXRhaWwiIHN0eWxlPSJkaXNwbGF5Om5vbmUiPjxkaXYgaWQ9ImFpUmVzdWx0Ij4nCiAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjhweCI+JwogICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo4cHg7aGVpZ2h0OjIwcHg7YW5pbWF0aW9uOnNrZWxldG9uIDEuMnMgaW5maW5pdGUiPjwvZGl2PicKICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjhmYWZjO2JvcmRlci1yYWRpdXM6OHB4O2hlaWdodDo2MHB4O2FuaW1hdGlvbjpza2VsZXRvbiAxLjJzIGluZmluaXRlO2FuaW1hdGlvbi1kZWxheTouMnMiPjwvZGl2PicKICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjhmYWZjO2JvcmRlci1yYWRpdXM6OHB4O2hlaWdodDo0MHB4O2FuaW1hdGlvbjpza2VsZXRvbiAxLjJzIGluZmluaXRlO2FuaW1hdGlvbi1kZWxheTouNHMiPjwvZGl2PicKICAgICsnPC9kaXY+PC9kaXY+PC9kaXY+PC9kaXY+JzsKICBodG1sKz0nPGRpdiBjbGFzcz0ibmF2ZXItc2VjdGlvbiI+PGgzPjxzcGFuPk48L3NwYW4+IOuEpOydtOuyhCDsh7ztlZEg7Iuc7IS4PC9oMz48ZGl2IGlkPSJuYXZlclJlc3VsdCI+JwogICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo4cHgiPicKICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDoxMnB4O2FsaWduLWl0ZW1zOmNlbnRlciI+PGRpdiBzdHlsZT0id2lkdGg6NTZweDtoZWlnaHQ6NTZweDtiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo4cHg7YW5pbWF0aW9uOnNrZWxldG9uIDEuMnMgaW5maW5pdGU7ZmxleC1zaHJpbms6MCI+PC9kaXY+PGRpdiBzdHlsZT0iZmxleDoxIj48ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo0cHg7aGVpZ2h0OjE0cHg7d2lkdGg6NzAlO2FuaW1hdGlvbjpza2VsZXRvbiAxLjJzIGluZmluaXRlIj48L2Rpdj48ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo0cHg7aGVpZ2h0OjEycHg7d2lkdGg6NDAlO21hcmdpbi10b3A6NnB4O2FuaW1hdGlvbjpza2VsZXRvbiAxLjJzIGluZmluaXRlO2FuaW1hdGlvbi1kZWxheTouMnMiPjwvZGl2PjwvZGl2PjwvZGl2PicKICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDoxMnB4O2FsaWduLWl0ZW1zOmNlbnRlciI+PGRpdiBzdHlsZT0id2lkdGg6NTZweDtoZWlnaHQ6NTZweDtiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo4cHg7YW5pbWF0aW9uOnNrZWxldG9uIDEuMnMgaW5maW5pdGU7ZmxleC1zaHJpbms6MCI+PC9kaXY+PGRpdiBzdHlsZT0iZmxleDoxIj48ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo0cHg7aGVpZ2h0OjE0cHg7d2lkdGg6NjAlO2FuaW1hdGlvbjpza2VsZXRvbiAxLjJzIGluZmluaXRlIj48L2Rpdj48ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmOGZhZmM7Ym9yZGVyLXJhZGl1czo0cHg7aGVpZ2h0OjEycHg7d2lkdGg6MzAlO21hcmdpbi10b3A6NnB4O2FuaW1hdGlvbjpza2VsZXRvbiAxLjJzIGluZmluaXRlO2FuaW1hdGlvbi1kZWxheTouMnMiPjwvZGl2PjwvZGl2PjwvZGl2PicKICAgICsnPC9kaXY+PC9kaXY+PC9kaXY+JzsKCiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjYW5NYWluQ29udGVudCcpLmlubmVySFRNTD1odG1sOwoKICAvLyDilZDilZDilZAgMuuLqOqzhDog7LqQ7IucIOKGkiDshJzrsoQg7Iic7ISc66GcIOyhsO2ajCDilZDilZDilZAKICB2YXIgY2FjaGVLZXk9cC5iYXJjb2RlOwogIGlmKHNjYW5DYWNoZVtjYWNoZUtleV0mJnNjYW5DYWNoZVtjYWNoZUtleV0uYWkpewogICAgcmVuZGVyQUkoc2NhbkNhY2hlW2NhY2hlS2V5XS5haSk7CiAgfSBlbHNlIHsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7CiAgICBpZighc2NhbkNhY2hlW2NhY2hlS2V5XSlzY2FuQ2FjaGVbY2FjaGVLZXldPXt9OwogICAgc2NhbkNhY2hlW2NhY2hlS2V5XS5haT1yOwogICAgcmVuZGVyQUkocik7CiAgfSkuZ2V0QUlTYWxlc1BvaW50cyhwLmJhcmNvZGUscC5uYW1lLHAuc2VsbFByaWNlLHAuc3VwcGx5UHJpY2UpOwogIH0KICBpZihzY2FuQ2FjaGVbY2FjaGVLZXldJiZzY2FuQ2FjaGVbY2FjaGVLZXldLm5hdmVyKXsKICAgIHJlbmRlck5hdmVyKHNjYW5DYWNoZVtjYWNoZUtleV0ubmF2ZXIpOwogIH0gZWxzZSB7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpewogICAgaWYoIXNjYW5DYWNoZVtjYWNoZUtleV0pc2NhbkNhY2hlW2NhY2hlS2V5XT17fTsKICAgIHNjYW5DYWNoZVtjYWNoZUtleV0ubmF2ZXI9cjsKICAgIHJlbmRlck5hdmVyKHIpOwogIH0pLnNlYXJjaE5hdmVyU2hvcHBpbmcocC5uYW1lKTsKICB9Cn0KCmZ1bmN0aW9uIHJlbmRlckFJKHIpewogICAgdmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaVJlc3VsdCcpO2lmKCFlbClyZXR1cm47CiAgICBpZighci5vayl7ZWwuaW5uZXJIVE1MPXIubm9LZXk/JzxkaXYgc3R5bGU9ImNvbG9yOiM4ODg7Zm9udC1zaXplOjEycHg7cGFkZGluZzo4cHgiPkFJIO2CpCDrr7jshKTsoJU8L2Rpdj4nOic8ZGl2IHN0eWxlPSJjb2xvcjojODg4O2ZvbnQtc2l6ZToxMnB4O3BhZGRpbmc6OHB4Ij5BSSDrtoTshJ0g7Iuk7YyoIDxidXR0b24gb25jbGljaz0icmV0cnlBSSgpIiBzdHlsZT0ibWFyZ2luLWxlZnQ6OHB4O3BhZGRpbmc6NHB4IDEycHg7Ym9yZGVyOjFweCBzb2xpZCAjZGRkO2JvcmRlci1yYWRpdXM6NnB4O2JhY2tncm91bmQ6I2ZmZjtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTFweDtmb250LWZhbWlseTppbmhlcml0Ij7snqzsi5zrj4Q8L2J1dHRvbj48L2Rpdj4nO3JldHVybn0KICAgIHZhciBkPXIuZGF0YTsKICAgIHZhciBobD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWlIZWFkbGluZScpO2lmKGhsKWhsLnRleHRDb250ZW50PWQuaGVhZGxpbmV8fCcnOwogICAgdmFyIGgyPScnOwogICAgaWYoZC53aGF0X2lzKWgyKz0nPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjhmYWZjO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTJweDttYXJnaW4tYm90dG9tOjEwcHg7Ym9yZGVyLWxlZnQ6M3B4IHNvbGlkICM0YWRlODAiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjojMEY2RTU2O21hcmdpbi1ib3R0b206NHB4Ij7wn5OLIOygnO2SiCDshKTrqoU8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTNweDtjb2xvcjojNTU1O2xpbmUtaGVpZ2h0OjEuNiI+JytkLndoYXRfaXMrJzwvZGl2PjwvZGl2Pic7CiAgICBpZihkLmRlc2NyaXB0aW9uKWgyKz0nPGRpdiBzdHlsZT0iZm9udC1zaXplOjEzcHg7Y29sb3I6IzU1NTttYXJnaW4tYm90dG9tOjEwcHg7bGluZS1oZWlnaHQ6MS41Ij4nK2QuZGVzY3JpcHRpb24rJzwvZGl2Pic7CiAgICBpZihkLndoeV9nb29kJiZkLndoeV9nb29kLmxlbmd0aCloMis9JzxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi1ib3R0b206NHB4Ij7inIUg7Zqo64qlPC9kaXY+JytkLndoeV9nb29kLm1hcChmdW5jdGlvbihiKXtyZXR1cm4gJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiM1NTU7cGFkZGluZzozcHggMDtsaW5lLWhlaWdodDoxLjUiPuKAoiAnK2IrJzwvZGl2Pid9KS5qb2luKCcnKSsnPC9kaXY+JzsKICAgIGlmKGQud2hvX25lZWRzJiZkLndob19uZWVkcy5sZW5ndGgpaDIrPSc8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tYm90dG9tOjRweCI+8J+OryDstpTsspwg64yA7IOBPC9kaXY+JytkLndob19uZWVkcy5tYXAoZnVuY3Rpb24odyl7cmV0dXJuICc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtjb2xvcjojNTU1O3BhZGRpbmc6M3B4IDAiPuKAoiAnK3crJzwvZGl2Pid9KS5qb2luKCcnKSsnPC9kaXY+JzsKICAgIGlmKGQuaG93X3RvX3VzZSloMis9JzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2VmZjZmZjtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHggMTJweDttYXJnaW4tYm90dG9tOjEwcHgiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjojMWU0MGFmO21hcmdpbi1ib3R0b206MnB4Ij7ij7Ag67O17Jqp67KVPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6IzFlNDBhZiI+JytkLmhvd190b191c2UrJzwvZGl2PjwvZGl2Pic7CiAgICBpZihkLnN5bmVyZ3kpaDIrPSc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZWZjZTg7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4IDEycHg7bWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7Y29sb3I6Izg1NGQwZTttYXJnaW4tYm90dG9tOjJweCI+8J+knSDsi5zrhIjsp4A8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtjb2xvcjojODU0ZDBlIj4nK2Quc3luZXJneSsnPC9kaXY+PC9kaXY+JzsKICAgIGlmKGQuYmVuZWZpdHMmJmQuYmVuZWZpdHMubGVuZ3RoKWgyKz0nPGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij48ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7bWFyZ2luLWJvdHRvbTo0cHgiPuKchSDsnqXsoJA8L2Rpdj4nK2QuYmVuZWZpdHMubWFwKGZ1bmN0aW9uKGIpe3JldHVybiAnPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6IzU1NTtwYWRkaW5nOjNweCAwIj7igKIgJytiKyc8L2Rpdj4nfSkuam9pbignJykrJzwvZGl2Pic7CiAgICBpZihkLnRhbGtfcG9pbnRzJiZkLnRhbGtfcG9pbnRzLmxlbmd0aCloMis9JzxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206MTBweCI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi1ib3R0b206NHB4Ij7wn46ZIOuwqeyGoSDrqZjtirg8L2Rpdj4nK2QudGFsa19wb2ludHMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiAnPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6IzU1NTtwYWRkaW5nOjNweCAwIj7igKIgJyt0Kyc8L2Rpdj4nfSkuam9pbignJykrJzwvZGl2Pic7CiAgICBpZihkLnNjZW5hcmlvKWgyKz0nPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmFmNWZmO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweCAxMnB4O21hcmdpbi1ib3R0b206MTBweDtib3JkZXItbGVmdDozcHggc29saWQgI2E4NTVmNyI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO2NvbG9yOiM3YzNhZWQ7bWFyZ2luLWJvdHRvbToycHgiPvCfk5Yg7Iuc64KY66as7JikPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6IzZiMjFhODtsaW5lLWhlaWdodDoxLjYiPicrZC5zY2VuYXJpbysnPC9kaXY+PC9kaXY+JzsKICAgIGlmKGQuYmVmb3JlX2FmdGVyKWgyKz0nPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmZmN2VkO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweCAxMnB4O21hcmdpbi1ib3R0b206MTBweDtib3JkZXItbGVmdDozcHggc29saWQgI2Y5NzMxNiI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO2NvbG9yOiNjMjQxMGM7bWFyZ2luLWJvdHRvbToycHgiPvCfk4gg7KCE7ZuEIOuzgO2ZlDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiM5YTM0MTI7bGluZS1oZWlnaHQ6MS42Ij4nK2QuYmVmb3JlX2FmdGVyKyc8L2Rpdj48L2Rpdj4nOwogICAgaWYoZC5wcmljZV90YWxrKWgyKz0nPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjBmZGY0O2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweCAxMnB4Ij48ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7Y29sb3I6IzE2NjUzNDttYXJnaW4tYm90dG9tOjJweCI+8J+SsCDqsIDqsqkg7Ja07ZWEPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEzcHg7Y29sb3I6IzE2NjUzNCI+JytkLnByaWNlX3RhbGsrJzwvZGl2PjwvZGl2Pic7CiAgICBlbC5pbm5lckhUTUw9aDI7Cn0KCmZ1bmN0aW9uIHJlbmRlck5hdmVyKHIpewogICAgdmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCduYXZlclJlc3VsdCcpO2lmKCFlbClyZXR1cm47CiAgICBpZighci5va3x8IXIuaXRlbXN8fHIuaXRlbXMubGVuZ3RoPT09MCl7ZWwuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjEycHgiPjxhIGhyZWY9IicrKHIudXJsfHwnIycpKyciIHRhcmdldD0iX2JsYW5rIiBzdHlsZT0iY29sb3I6IzAzYzc1YTtmb250LXNpemU6MTNweCI+64Sk7J2067KE7JeQ7IScIOyngeygkSDqsoDsg4kg4oaSPC9hPjwvZGl2Pic7cmV0dXJufQogICAgdmFyIGg9Jyc7ci5pdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pe2grPSc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO3BhZGRpbmc6MTBweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNmMGYwZjA7Z2FwOjEycHgiPicrKGl0ZW0uaW1hZ2U/JzxpbWcgc3JjPSInK2l0ZW0uaW1hZ2UrJyIgc3R5bGU9IndpZHRoOjU2cHg7aGVpZ2h0OjU2cHg7Ym9yZGVyLXJhZGl1czo4cHg7b2JqZWN0LWZpdDpjb3Zlcjtib3JkZXI6MXB4IHNvbGlkICNlZWU7ZmxleC1zaHJpbms6MCIgb25lcnJvcj0idGhpcy5zdHlsZS5kaXNwbGF5PVwnbm9uZVwnIj4nOicnKSsnPGRpdiBzdHlsZT0iZmxleDoxO21pbi13aWR0aDowIj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTNweDtmb250LXdlaWdodDo1MDA7b3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7d2hpdGUtc3BhY2U6bm93cmFwIj4nK2l0ZW0udGl0bGUrJzwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM4ODg7bWFyZ2luLXRvcDoycHgiPicraXRlbS5tYWxsKyc8L2Rpdj48L2Rpdj48ZGl2IHN0eWxlPSJmb250LXdlaWdodDo3MDA7Y29sb3I6IzAzYzc1YTtmb250LXNpemU6MTRweDt3aGl0ZS1zcGFjZTpub3dyYXAiPuKCqScrZm10KGl0ZW0ucHJpY2UpKyc8L2Rpdj48L2Rpdj4nfSk7CiAgICBlbC5pbm5lckhUTUw9aDsKfQoKZnVuY3Rpb24gcmV0cnlBSSgpe2lmKGxhc3RTY2FubmVkUHJvZHVjdClnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7dmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaVJlc3VsdCcpO2lmKCFlbClyZXR1cm47aWYoci5vayYmci5kYXRhKXt2YXIgZD1yLmRhdGE7ZWwuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTZweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzBGNkU1NjttYXJnaW4tYm90dG9tOjhweCI+JytkLmhlYWRsaW5lKyc8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTNweDtjb2xvcjojNTU1Ij4nK2QuZGVzY3JpcHRpb24rJzwvZGl2Pid9ZWxzZXtlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9ImFpLWxvYWRpbmciPuu2hOyEnSDsi6TtjKg8L2Rpdj4nfX0pLmdldEFJU2FsZXNQb2ludHMobGFzdFNjYW5uZWRQcm9kdWN0LmJhcmNvZGUsbGFzdFNjYW5uZWRQcm9kdWN0Lm5hbWUsbGFzdFNjYW5uZWRQcm9kdWN0LnNlbGxQcmljZSxsYXN0U2Nhbm5lZFByb2R1Y3Quc3VwcGx5UHJpY2UpfQoKZnVuY3Rpb24gYWRkU2Nhbkhpc3RvcnkocCl7CiAgdmFyIG5vdz1uZXcgRGF0ZSgpO3ZhciB0aW1lPW5vdy5nZXRIb3VycygpLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwnMCcpKyc6Jytub3cuZ2V0TWludXRlcygpLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwnMCcpOwogIHNjYW5IaXN0b3J5TGlzdD1zY2FuSGlzdG9yeUxpc3QuZmlsdGVyKGZ1bmN0aW9uKHMpe3JldHVybiBzLmJhcmNvZGUhPT1wLmJhcmNvZGV9KTsKICBzY2FuSGlzdG9yeUxpc3QudW5zaGlmdCh7Y29kZTpwLmNvZGUsbmFtZTpwLm5hbWUsdGltZTp0aW1lLGJhcmNvZGU6cC5iYXJjb2RlfSk7CiAgaWYoc2Nhbkhpc3RvcnlMaXN0Lmxlbmd0aD4xMClzY2FuSGlzdG9yeUxpc3Q9c2Nhbkhpc3RvcnlMaXN0LnNsaWNlKDAsMTApOwogIHZhciBodG1sPScnO3NjYW5IaXN0b3J5TGlzdC5mb3JFYWNoKGZ1bmN0aW9uKHMpe2h0bWwrPSc8ZGl2IGNsYXNzPSJzY2FuLWhpc3RvcnktaXRlbSIgc3R5bGU9ImN1cnNvcjpwb2ludGVyIiBvbmNsaWNrPSJyZXNjYW5Qcm9kdWN0KFwnJytzLmJhcmNvZGUrJ1wnKSI+PHNwYW4+Jysocy5jb2RlPydbJytzLmNvZGUrJ10gJzonJykrKChzLm5hbWV8fCcnKS5zdWJzdHJpbmcoMCwxNSkpKyc8L3NwYW4+PHNwYW4+JytzLnRpbWUrJzwvc3Bhbj48L2Rpdj4nfSk7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjYW5IaXN0b3J5JykuaW5uZXJIVE1MPWh0bWw7Cn0KCnZhciBvcmRlclBhZEl0ZW1zPVtdOwoKZnVuY3Rpb24gc2hvd09yZGVyUGFkRm9ybShwcm9kdWN0KXsKICB2YXIgZm9ybT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJQYWRGb3JtJyk7CiAgaWYocHJvZHVjdCl7CiAgICBmb3JtLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJzsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclBhZFByb2R1Y3QnKS50ZXh0Q29udGVudD0n7IOB7ZKIOiAnK3Byb2R1Y3QubmFtZTsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcE5hbWUnKS52YWx1ZT0nJzsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcFF0eScpLnZhbHVlPScxJzsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcE9wdGlvbicpLnZhbHVlPScnOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wTmFtZScpLmZvY3VzKCk7CiAgfQp9CgpmdW5jdGlvbiBhZGRPcmRlclBhZCgpewogIHZhciBuYW1lPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcE5hbWUnKS52YWx1ZS50cmltKCk7CiAgaWYoIW5hbWUpe3Nob3dUb2FzdCgn7KO866y47J6QIOydtOumhOydhCDsnoXroKXtlZjshLjsmpQnLCdlcnJvcicpO3JldHVybn0KICB2YXIgcXR5PXBhcnNlSW50KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcFF0eScpLnZhbHVlKXx8MTsKICB2YXIgb3B0aW9uPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcE9wdGlvbicpLnZhbHVlLnRyaW0oKTsKICB2YXIgcD1sYXN0U2Nhbm5lZFByb2R1Y3Q7CiAgaWYoIXApe3Nob3dUb2FzdCgn66i87KCAIOuwlOy9lOuTnOulvCDsiqTsupTtlZjshLjsmpQnLCdlcnJvcicpO3JldHVybn0KICB2YXIgaXRlbT17aWQ6RGF0ZS5ub3coKSxwcm9kdWN0TmFtZTpwLm5hbWUsYmFyY29kZTpwLmJhcmNvZGUscHJpY2U6cC5zZWxsUHJpY2Usc3VwcGx5UHJpY2U6cC5zdXBwbHlQcmljZXx8MCwKICAgIGJ1eWVyOm5hbWUscXR5OnF0eSxvcHRpb246b3B0aW9uLGFtb3VudDpwLnNlbGxQcmljZSpxdHksdGltZTpuZXcgRGF0ZSgpLnRvTG9jYWxlVGltZVN0cmluZygna28tS1InLHtob3VyOicyLWRpZ2l0JyxtaW51dGU6JzItZGlnaXQnfSl9OwogIG9yZGVyUGFkSXRlbXMucHVzaChpdGVtKTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3BOYW1lJykudmFsdWU9Jyc7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wUXR5JykudmFsdWU9JzEnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcE9wdGlvbicpLnZhbHVlPScnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcE5hbWUnKS5mb2N1cygpOwogIHJlbmRlck9yZGVyUGFkKCk7Cn0KCmZ1bmN0aW9uIHJlbW92ZU9yZGVyUGFkKGlkKXsKICBvcmRlclBhZEl0ZW1zPW9yZGVyUGFkSXRlbXMuZmlsdGVyKGZ1bmN0aW9uKG8pe3JldHVybiBvLmlkIT09aWR9KTsKICByZW5kZXJPcmRlclBhZCgpOwp9CgpmdW5jdGlvbiByZW5kZXJPcmRlclBhZCgpewogIHZhciBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJQYWRMaXN0Jyk7CiAgdmFyIGNvdW50PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclBhZENvdW50Jyk7CiAgdmFyIGFjdGlvbnM9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyUGFkQWN0aW9ucycpOwogIGNvdW50LnRleHRDb250ZW50PW9yZGVyUGFkSXRlbXMubGVuZ3RoKyfqsbQnOwogIGlmKCFvcmRlclBhZEl0ZW1zLmxlbmd0aCl7CiAgICBlbC5pbm5lckhUTUw9JzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM0NzU1Njk7cGFkZGluZzo0cHggMCI+7KO866y4IOuCtOyXreydtCDsl4bsirXri4jri6Q8L2Rpdj4nOwogICAgYWN0aW9ucy5zdHlsZS5kaXNwbGF5PSdub25lJztyZXR1cm47CiAgfQogIGFjdGlvbnMuc3R5bGUuZGlzcGxheT0nYmxvY2snOwogIHZhciB0b3RhbFF0eT0wLHRvdGFsQW10PTA7CiAgdmFyIGg9Jyc7CiAgb3JkZXJQYWRJdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKG8pewogICAgdG90YWxRdHkrPW8ucXR5O3RvdGFsQW10Kz1vLmFtb3VudDsKICAgIGgrPSc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO3BhZGRpbmc6NXB4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzFlMjkzYjtmb250LXNpemU6MTBweCI+JwogICAgICArJzxkaXYgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6MCI+PGRpdiBzdHlsZT0iY29sb3I6I2UyZThmMDtmb250LXdlaWdodDo2MDA7d2hpdGUtc3BhY2U6bm93cmFwO292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzIj4nK28uYnV5ZXIrJyAoJytvLnF0eSsn6rCcKTwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJjb2xvcjojNjQ3NDhiO3doaXRlLXNwYWNlOm5vd3JhcDtvdmVyZmxvdzpoaWRkZW47dGV4dC1vdmVyZmxvdzplbGxpcHNpcyI+Jysoby5wcm9kdWN0TmFtZXx8JycpLnN1YnN0cmluZygwLDE1KSsoby5vcHRpb24/JyDCtyAnK28ub3B0aW9uOicnKSsnPC9kaXY+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweDtmbGV4LXNocmluazowIj48c3BhbiBzdHlsZT0iY29sb3I6IzRhZGU4MDtmb250LXdlaWdodDo2MDAiPuKCqScrZm10KG8uYW1vdW50KSsnPC9zcGFuPicKICAgICAgKyc8YnV0dG9uIG9uY2xpY2s9InJlbW92ZU9yZGVyUGFkKCcrby5pZCsnKSIgc3R5bGU9ImJhY2tncm91bmQ6bm9uZTtib3JkZXI6bm9uZTtjb2xvcjojZjg3MTcxO2N1cnNvcjpwb2ludGVyO2ZvbnQtc2l6ZToxMnB4O3BhZGRpbmc6MnB4Ij7inJU8L2J1dHRvbj48L2Rpdj48L2Rpdj4nOwogIH0pOwogIGVsLmlubmVySFRNTD1oOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclBhZFRvdGFsJykudGV4dENvbnRlbnQ9b3JkZXJQYWRJdGVtcy5sZW5ndGgrJ+qxtCAoJyt0b3RhbFF0eSsn6rCcKSAvIOKCqScrZm10KHRvdGFsQW10KTsKfQoKZnVuY3Rpb24gZG93bmxvYWRPcmRlclBhZCgpewogIGlmKCFvcmRlclBhZEl0ZW1zLmxlbmd0aCl7c2hvd1RvYXN0KCfso7zrrLgg64K07Jet7J20IOyXhuyKteuLiOuLpCcsJ2luZm8nKTtyZXR1cm59CiAgdmFyIHJvd3M9W1sn7KO866y47J6QJywn7Jew65297LKYJywn7KO87IaMJywn7IOB7ZKI66qFJywn67CU7L2U65OcJywn7IiY65+JJywn7Ji17IWYL+uplOuqqCcsJ+yeheq4iOyVoScsJ+qzteq4ieqwgCjqsJzri7kpJywn6rO16riJ6rCAKO2VqeqzhCknLCfrp4jsp4QnLCfso7zrrLjsi5zqsIQnXV07CiAgb3JkZXJQYWRJdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKG8pewogICAgdmFyIHN1cFRvdGFsPShvLnN1cHBseVByaWNlfHwwKSpvLnF0eTsKICAgIHZhciBtYXJnaW49by5hbW91bnQtc3VwVG90YWw7CiAgICByb3dzLnB1c2goW28uYnV5ZXIsJycsJycsby5wcm9kdWN0TmFtZSxvLmJhcmNvZGUsby5xdHksby5vcHRpb24sby5hbW91bnQsby5zdXBwbHlQcmljZXx8MCxzdXBUb3RhbCxtYXJnaW4sby50aW1lXSk7CiAgfSk7CiAgdmFyIHdzPVhMU1gudXRpbHMuYW9hX3RvX3NoZWV0KHJvd3MpOwogIHZhciB3Yj1YTFNYLnV0aWxzLmJvb2tfbmV3KCk7CiAgWExTWC51dGlscy5ib29rX2FwcGVuZF9zaGVldCh3Yix3cywn67Cc7KO87IScJyk7CiAgd3NbJyFjb2xzJ109W3t3Y2g6MTB9LHt3Y2g6MTN9LHt3Y2g6MjV9LHt3Y2g6Mjh9LHt3Y2g6MTV9LHt3Y2g6NX0se3djaDoxMn0se3djaDoxMH0se3djaDoxMH0se3djaDoxMH0se3djaDoxMH0se3djaDoxMH1dOwogIHZhciB1TmFtZT1jdXJyZW50VXNlcj9jdXJyZW50VXNlci5uYW1lOifshYDrn6wnO1hMU1gud3JpdGVGaWxlKHdiLHVOYW1lKydfJytuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwxMCkrJy54bHN4Jyk7Cn0KCmZ1bmN0aW9uIHJlc2NhblByb2R1Y3QoYmMpewogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiYXJjb2RlSW5wdXQnKS52YWx1ZT1iYzsKICBkb1NjYW4oKTsKfQoKdmFyIHNlbGVjdGVkT3JkZXJDYXRlZ29yeT0n7J2867CYJzsKZnVuY3Rpb24gc2VsZWN0T3JkZXJUeXBlKGJ0bix0eXBlKXsKICBzZWxlY3RlZE9yZGVyQ2F0ZWdvcnk9dHlwZTsKICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcub3JkZXItdHlwZS1idG4nKS5mb3JFYWNoKGZ1bmN0aW9uKGIpewogICAgYi5zdHlsZS5ib3JkZXJDb2xvcj0nI2UyZThmMCc7Yi5zdHlsZS5iYWNrZ3JvdW5kPScjZmZmJztiLnN0eWxlLmNvbG9yPScjNjQ3NDhiJzsKICB9KTsKICBidG4uc3R5bGUuYm9yZGVyQ29sb3I9JyM0YWRlODAnO2J0bi5zdHlsZS5iYWNrZ3JvdW5kPScjZjBmZGY0JztidG4uc3R5bGUuY29sb3I9JyMxNjY1MzQnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWxlY3RlZE9yZGVyVHlwZScpLnRleHRDb250ZW50PSfshKDtg506ICcrdHlwZSsn67Cc7KO87IScJzsKfQoKZnVuY3Rpb24gZG93bmxvYWRPcmRlclRlbXBsYXRlKCl7CiAgdmFyIHRvZGF5PW5ldyBEYXRlKCk7CiAgdmFyIHk9dG9kYXkuZ2V0RnVsbFllYXIoKSxtPXRvZGF5LmdldE1vbnRoKCkrMSxkPXRvZGF5LmdldERhdGUoKTsKICB2YXIgZGF0ZVN0cj15KyctJysobTwxMD8nMCcrbTptKSsnLScrKGQ8MTA/JzAnK2Q6ZCk7CiAgdmFyIHVzZXJOYW1lPWN1cnJlbnRVc2VyP2N1cnJlbnRVc2VyLm5hbWU6J+yFgOufrCc7CiAgdmFyIGZpbGVOYW1lPXVzZXJOYW1lKydfJytkYXRlU3RyKycueGxzeCc7CiAgdmFyIGhlYWRlcnM9W1sn7KO866y47J6QJywn7Jew65297LKYJywn7KO87IaMJywn7KCc7ZKI66qFJywn67CU7L2U65OcJywn7IiY65+JJywn7YyQ66ek6rCAJywn6rO16riJ6rCAJywn7Ji17IWYL+uplOuqqCddXTsKICB2YXIgc2FtcGxlPVtbJ+2Zjeq4uOuPmScsJzAxMC0xMjM0LTU2NzgnLCfshJzsmrjsi5wg6rCV64Ko6rWsIO2FjO2XpOuegOuhnCAxMjMnLCfruYTtg4Drr7xDIDEwMDBtZycsJzg4MDEyMzQ1Njc4OTAnLCcxJywnMjk5MDAnLCcxMjAwMCcsJyddXTsKICB2YXIgd3M9WExTWC51dGlscy5hb2FfdG9fc2hlZXQoaGVhZGVycy5jb25jYXQoc2FtcGxlKSk7CiAgd3NbJyFjb2xzJ109W3t3Y2g6MTB9LHt3Y2g6MTR9LHt3Y2g6MzB9LHt3Y2g6MjB9LHt3Y2g6MTV9LHt3Y2g6Nn0se3djaDoxMH0se3djaDoxMH0se3djaDoxNX1dOwogIHZhciB3Yj1YTFNYLnV0aWxzLmJvb2tfbmV3KCk7CiAgWExTWC51dGlscy5ib29rX2FwcGVuZF9zaGVldCh3Yix3cywn67Cc7KO87IScJyk7CiAgWExTWC53cml0ZUZpbGUod2IsZmlsZU5hbWUpOwogIHNob3dUb2FzdChmaWxlTmFtZSsnIOuLpOyatOuhnOuTnCDsmYTro4wnLCdzdWNjZXNzJyk7Cn0KCnZhciB1cGxvYWRlZE9yZGVyRGF0YT1udWxsOwoKZnVuY3Rpb24gb25PcmRlckZpbGVTZWxlY3QoaW5wdXQpewogIGlmKCFpbnB1dC5maWxlcy5sZW5ndGgpcmV0dXJuOwogIHZhciBmaWxlPWlucHV0LmZpbGVzWzBdOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlckZpbGVOYW1lJykudGV4dENvbnRlbnQ9ZmlsZS5uYW1lOwogIHZhciByZWFkZXI9bmV3IEZpbGVSZWFkZXIoKTsKICByZWFkZXIub25sb2FkPWZ1bmN0aW9uKGUpewogICAgdHJ5ewogICAgICB2YXIgZGF0YT1lLnRhcmdldC5yZXN1bHQ7CiAgICAgIHZhciB3Yj1YTFNYLnJlYWQoZGF0YSx7dHlwZTonYXJyYXknfSk7CiAgICAgIHZhciB3cz13Yi5TaGVldHNbd2IuU2hlZXROYW1lc1swXV07CiAgICAgIHZhciBqc29uPVhMU1gudXRpbHMuc2hlZXRfdG9fanNvbih3cyk7CiAgICAgIHVwbG9hZGVkT3JkZXJEYXRhPWpzb247CiAgICAgIHZhciB0b3RhbFF0eT0wLHRvdGFsQW10PTAsdG90YWxTdXBwbHk9MCx0b3RhbE1hcmdpbj0wLGJ1eWVycz17fSx0b3RhbEl0ZW1zPTA7CiAgICAgIGpzb24uZm9yRWFjaChmdW5jdGlvbihyKXsKICAgICAgICB2YXIgcXR5PU51bWJlcihyWyfsiJjrn4knXSl8fDE7CiAgICAgICAgdmFyIGFtdD1OdW1iZXIoclsn7J6F6riI7JWhJ10pfHxOdW1iZXIoclsn6riI7JWhJ10pfHwwOwogICAgICAgIHZhciBzdXA9TnVtYmVyKHJbJ+qzteq4ieqwgCjtlanqs4QpJ10pfHwwOwogICAgICAgIHZhciBtcmc9TnVtYmVyKHJbJ+uniOynhCddKXx8MDsKICAgICAgICBpZighYW10JiZyWyfsnoXquIjslaEnXT09PXVuZGVmaW5lZCl7Zm9yKHZhciByayBpbiByKXtpZihyay5pbmRleE9mKCfsnoXquIgnKT49MHx8cmsuaW5kZXhPZign6riI7JWhJyk+PTApYW10PU51bWJlcihyW3JrXSl8fDB9fQogICAgICAgIGlmKCFzdXAmJmFtdD4wKXtzdXA9YW10LW1yZ30KICAgICAgICBpZighbXJnJiZhbXQ+MCYmc3VwPjApe21yZz1hbXQtc3VwfQogICAgICAgIHRvdGFsUXR5Kz1xdHk7dG90YWxBbXQrPWFtdDt0b3RhbFN1cHBseSs9c3VwO3RvdGFsTWFyZ2luKz1tcmc7dG90YWxJdGVtcysrOwogICAgICAgIHZhciBidXllcj1yWyfso7zrrLjsnpAnXXx8clsn7IiY66C57J6QJ118fHJbJ2J1eWVyJ118fCcnOwogICAgICAgIGlmKGJ1eWVyKWJ1eWVyc1tidXllcl09dHJ1ZTsKICAgICAgfSk7CiAgICAgIHZhciBidXllckNvdW50PU9iamVjdC5rZXlzKGJ1eWVycykubGVuZ3RoOwogICAgICB2YXIgbWFyZ2luUmF0ZT10b3RhbEFtdD4wP01hdGgucm91bmQodG90YWxNYXJnaW4vdG90YWxBbXQqMTAwKTowOwogICAgICB2YXIgbXJDb2xvcj1tYXJnaW5SYXRlPj0zMD8nIzBGNkU1Nic6bWFyZ2luUmF0ZT49MTU/JyNmNTllMGInOicjZGMyNjI2JzsKICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyUHJldmlldycpLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJzsKICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyUHJldmlldycpLmlubmVySFRNTD0nPGRpdiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDo4cHg7bWFyZ2luLWJvdHRvbTo4cHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YwZmRmNDtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxNHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojODg4O21hcmdpbi1ib3R0b206MnB4Ij7soITssrQg66ek7Lac7JWhPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjIwcHg7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOiMwRjZFNTYiPuKCqScrZm10KHRvdGFsQW10KSsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmVmY2U4O2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjE0cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM4ODg7bWFyZ2luLWJvdHRvbToycHgiPuuniOynhDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToyMHB4O2ZvbnQtd2VpZ2h0OjgwMDtjb2xvcjojZjU5ZTBiIj7igqknK2ZtdCh0b3RhbE1hcmdpbikrJzwvZGl2PjwvZGl2PicKICAgICAgICArJzwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmcjtnYXA6OHB4O21hcmdpbi1ib3R0b206OHB4Ij4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjJweCBzb2xpZCAnK21yQ29sb3IrJztib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxNHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojODg4O21hcmdpbi1ib3R0b206MnB4Ij7rp4jsp4TsnKg8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MjJweDtmb250LXdlaWdodDo4MDA7Y29sb3I6JyttckNvbG9yKyciPicrbWFyZ2luUmF0ZSsnJTwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZhZjVmZjtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxNHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojODg4O21hcmdpbi1ib3R0b206MnB4Ij7snoXquIjtlaAg6rO16riJ6rCAPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjIwcHg7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOiM3YzNhZWQiPuKCqScrZm10KHRvdGFsU3VwcGx5KSsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDo4cHg7bWFyZ2luLWJvdHRvbToxMnB4Ij4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMWY1Zjk7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MTJweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Y29sb3I6Izg4ODttYXJnaW4tYm90dG9tOjJweCI+6rWs66ek7J6Q7IiYPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE4cHg7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOiMzYjgyZjYiPicrYnV5ZXJDb3VudCsnPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMXB4Ij7rqoU8L3NwYW4+PC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjFmNWY5O2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjEycHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM4ODg7bWFyZ2luLWJvdHRvbToycHgiPu2MkOunpOusvOqxtDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxOHB4O2ZvbnQtd2VpZ2h0OjgwMDtjb2xvcjojMzM0MTU1Ij4nK3RvdGFsUXR5Kyc8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExcHgiPuqwnCAoJyt0b3RhbEl0ZW1zKyfqsbQpPC9zcGFuPjwvZGl2PjwvZGl2PicKICAgICAgICArJzwvZGl2PicKICAgICAgICArJzxkaXYgaWQ9Im9yZGVyU3RhdHVzIiBzdHlsZT0iZGlzcGxheTpub25lO3BhZGRpbmc6MTBweDtib3JkZXItcmFkaXVzOjhweDttYXJnaW4tYm90dG9tOjEwcHg7Zm9udC1zaXplOjEycHgiPjwvZGl2PicKICAgICAgICArJzxidXR0b24gY2xhc3M9ImJ0biBidG4tZ3JlZW4iIG9uY2xpY2s9InN1Ym1pdE9yZGVyVXBsb2FkKCkiIGlkPSJidG5TdWJtaXRPcmRlciI+67Cc7KO8IOuTseuhnTwvYnV0dG9uPic7CiAgICAgIHNob3dPcmRlclN0YXR1cygn4pyFIO2MjOydvCDrtoTshJ0g7JmE66OMISDtmZXsnbgg7ZuEIOuwnOyjvCDrk7HroZ3snYQg64iM65+s7KO87IS47JqUJywnI2QxZmFlNScsJyMwNjVmNDYnKTsKICAgIH1jYXRjaChleCl7CiAgICAgIHNob3dPcmRlclN0YXR1cygn4p2MIO2MjOydvCDsnb3quLAg7Iuk7YyoOiAnK2V4Lm1lc3NhZ2UsJyNmZWYyZjInLCcjZGMyNjI2Jyk7CiAgICB9CiAgfTsKICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoZmlsZSk7Cn0KCmZ1bmN0aW9uIHNob3dPcmRlclN0YXR1cyhtc2csYmcsY29sb3IpewogIHZhciBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJTdGF0dXMnKTsKICBlbC5zdHlsZS5kaXNwbGF5PSdibG9jayc7ZWwuc3R5bGUuYmFja2dyb3VuZD1iZztlbC5zdHlsZS5jb2xvcj1jb2xvcjtlbC50ZXh0Q29udGVudD1tc2c7Cn0KCmZ1bmN0aW9uIHN1Ym1pdE9yZGVyVXBsb2FkKCl7CiAgaWYoIXVwbG9hZGVkT3JkZXJEYXRhfHwhdXBsb2FkZWRPcmRlckRhdGEubGVuZ3RoKXtzaG93VG9hc3QoJ+uovOyggCDrsJzso7zshJzrpbwg7JeF66Gc65Oc7ZWY7IS47JqUJywnaW5mbycpO3JldHVybn0KICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuU3VibWl0T3JkZXInKS5kaXNhYmxlZD10cnVlOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG5TdWJtaXRPcmRlcicpLnRleHRDb250ZW50PSfrk7HroZ0g7KSRLi4uJzsKICBzaG93TG9hZGluZygn67Cc7KO8IOuTseuhnSDspJEuLi4nKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7aGlkZUxvYWRpbmcoKTsKICAgIGlmKHIub2spewogICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJQcmV2aWV3JykuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMGZkZjQ7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MTZweDt0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW4tYm90dG9tOjEwcHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToyNHB4O21hcmdpbi1ib3R0b206NHB4Ij7inIU8L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTZweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzE2NjUzNCI+JytyLmNvdW50KyfqsbQg67Cc7KO8IOuTseuhnSDsmYTro4whPC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6IzA2NWY0NjttYXJnaW4tdG9wOjRweCI+6rWs66ek7J6QICcrci5idXllcnMrJ+uqhSB8IOunpOy2nCDigqknK2ZtdChyLnRvdGFsQW1vdW50KSsnIHwg66eI7KeEIOKCqScrZm10KHIudG90YWxNYXJnaW4pKyc8L2Rpdj48L2Rpdj4nOwogICAgICB1cGxvYWRlZE9yZGVyRGF0YT1udWxsOwogICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuU3VibWl0T3JkZXInKS50ZXh0Q29udGVudD0n65Ox66GdIOyZhOujjCc7CiAgICAgIGxvYWRSZWNlbnRPcmRlcnMoKTsKICAgIH1lbHNlewogICAgICBzaG93T3JkZXJTdGF0dXMoJ+KdjCDrk7HroZ0g7Iuk7YyoOiAnKyhyLm1zZ3x8JycpLCcjZmVmMmYyJywnI2RjMjYyNicpOwogICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuU3VibWl0T3JkZXInKS5kaXNhYmxlZD1mYWxzZTsKICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0blN1Ym1pdE9yZGVyJykudGV4dENvbnRlbnQ9J+uwnOyjvCDrk7HroZ0nOwogICAgfQogIH0pLnN1Ym1pdEJ1bGtPcmRlcih7b3JkZXJzOnVwbG9hZGVkT3JkZXJEYXRhLHNlbGxlcjpjdXJyZW50VXNlci5uYW1lLGFkbWluSWQ6Y3VycmVudFVzZXIuYWRtaW5JZHx8Jyd9KTsKfQoKZnVuY3Rpb24gZXhwYW5kT3JkZXJzKGRhdGUsYnRuKXsKICB2YXIgZGV0YWlsSWQ9J29yZGVyRGV0YWlsXycrZGF0ZS5yZXBsYWNlKC8tL2csJycpOwogIHZhciBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZChkZXRhaWxJZCk7CiAgaWYoZWwuc3R5bGUuZGlzcGxheT09PSdibG9jaycpe2VsLnN0eWxlLmRpc3BsYXk9J25vbmUnO2J0bi50ZXh0Q29udGVudD0n8J+TiyDsg4HshLjrs7TquLAnO3JldHVybn0KICBlbC5pbm5lckhUTUw9JzxkaXYgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO3BhZGRpbmc6OHB4O2NvbG9yOiM4ODg7Zm9udC1zaXplOjExcHgiPuuhnOuUqeykkS4uLjwvZGl2Pic7CiAgZWwuc3R5bGUuZGlzcGxheT0nYmxvY2snO2J0bi50ZXh0Q29udGVudD0n8J+TiyDsoJHquLAnOwogIHNob3dMb2FkaW5nKCk7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpe2hpZGVMb2FkaW5nKCk7CiAgICBpZighci5va3x8IXIub3JkZXJzLmxlbmd0aCl7ZWwuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPSJjb2xvcjojODg4O2ZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6OHB4Ij7so7zrrLgg7JeG7J2MPC9kaXY+JztyZXR1cm59CiAgICB2YXIgaD0nPGRpdiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6NnB4O292ZXJmbG93OmhpZGRlbiI+JwogICAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6NjBweCAxZnIgNDBweCA3MHB4IDgwcHggODBweDtiYWNrZ3JvdW5kOiNmMWY1Zjk7cGFkZGluZzo2cHggOHB4O2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjojNjQ3NDhiIj4nKwogICAgICAnPHNwYW4+7KO866y47J6QPC9zcGFuPjxzcGFuPuyDge2SiDwvc3Bhbj48c3Bhbj7siJjrn4k8L3NwYW4+PHNwYW4+6riI7JWhPC9zcGFuPjxzcGFuPuyeheq4iDwvc3Bhbj48c3Bhbj7stpzqs6A8L3NwYW4+PC9kaXY+JzsKICAgIHIub3JkZXJzLmZvckVhY2goZnVuY3Rpb24obyl7CiAgICAgIGgrPSc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjYwcHggMWZyIDQwcHggNzBweCA4MHB4IDgwcHg7cGFkZGluZzo1cHggOHB4O2JvcmRlci10b3A6MXB4IHNvbGlkICNmMGYwZjA7YWxpZ24taXRlbXM6Y2VudGVyIj4nCiAgICAgICAgKyc8c3BhbiBzdHlsZT0iZm9udC13ZWlnaHQ6NjAwIj4nK28uYnV5ZXIrJzwvc3Bhbj4nCiAgICAgICAgKyc8c3BhbiBzdHlsZT0ib3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7d2hpdGUtc3BhY2U6bm93cmFwIj4nK28ucHJvZHVjdCsnPC9zcGFuPicKICAgICAgICArJzxzcGFuPicrby5xdHkrJzwvc3Bhbj4nCiAgICAgICAgKyc8c3Bhbj7igqknK2ZtdChvLmFtb3VudCkrJzwvc3Bhbj4nCiAgICAgICAgKyc8c2VsZWN0IG9uY2hhbmdlPSJjaGFuZ2VTaW5nbGVTdGF0dXMoJytvLnJvdysnLFwncGF5XCcsdGhpcy52YWx1ZSkiIHN0eWxlPSJwYWRkaW5nOjJweDtib3JkZXI6MXB4IHNvbGlkICNkZGQ7Ym9yZGVyLXJhZGl1czo0cHg7Zm9udC1zaXplOjlweDtmb250LWZhbWlseTppbmhlcml0O2JhY2tncm91bmQ6Jysoby5wYXlTdGF0dXM9PT0n7J6F6riI7JmE66OMJz8nI2QxZmFlNSc6JyNmZWYyZjInKSsnIj48b3B0aW9uJysoby5wYXlTdGF0dXM9PT0n7J6F6riI7ZmV7J247KCEJz8nIHNlbGVjdGVkJzonJykrJz7snoXquIjtmZXsnbjsoIQ8L29wdGlvbj48b3B0aW9uJysoby5wYXlTdGF0dXM9PT0n7J6F6riI7JmE66OMJz8nIHNlbGVjdGVkJzonJykrJz7snoXquIjsmYTro4w8L29wdGlvbj48L3NlbGVjdD4nCiAgICAgICAgKyc8c2VsZWN0IG9uY2hhbmdlPSJjaGFuZ2VTaW5nbGVTdGF0dXMoJytvLnJvdysnLFwnc2hpcFwnLHRoaXMudmFsdWUpIiBzdHlsZT0icGFkZGluZzoycHg7Ym9yZGVyOjFweCBzb2xpZCAjZGRkO2JvcmRlci1yYWRpdXM6NHB4O2ZvbnQtc2l6ZTo5cHg7Zm9udC1mYW1pbHk6aW5oZXJpdDtiYWNrZ3JvdW5kOicrKG8uc2hpcFN0YXR1cz09PSfstpzqs6DsmYTro4wnPycjZDFmYWU1JzpvLnNoaXBTdGF0dXM9PT0n67Cc7Iah7KSA67mEJz8nI2RiZWFmZSc6JyNmOGZhZmMnKSsnIj48b3B0aW9uJysoby5zaGlwU3RhdHVzPT09J+uMgOq4sCc/JyBzZWxlY3RlZCc6JycpKyc+64yA6riwPC9vcHRpb24+PG9wdGlvbicrKG8uc2hpcFN0YXR1cz09PSfrsJzshqHspIDruYQnPycgc2VsZWN0ZWQnOicnKSsnPuuwnOyGoeykgOu5hDwvb3B0aW9uPjxvcHRpb24nKyhvLnNoaXBTdGF0dXM9PT0n7Lac6rOg7JmE66OMJz8nIHNlbGVjdGVkJzonJykrJz7stpzqs6DsmYTro4w8L29wdGlvbj48b3B0aW9uJysoby5zaGlwU3RhdHVzPT09J+u2gOu2hOy2nOqzoCc/JyBzZWxlY3RlZCc6JycpKyc+67aA67aE7Lac6rOgPC9vcHRpb24+PC9zZWxlY3Q+JwogICAgICAgICsnPC9kaXY+JzsKICAgIH0pOwogICAgaCs9JzwvZGl2Pic7CiAgICBlbC5pbm5lckhUTUw9aDsKICB9KS5nZXRPcmRlcnNCeURhdGUoZGF0ZSk7Cn0KCmZ1bmN0aW9uIGNoYW5nZVNpbmdsZVN0YXR1cyhyb3csZmllbGQsdmFsdWUpewogIHNob3dMb2FkaW5nKCk7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpe2hpZGVMb2FkaW5nKCk7CiAgICBpZighci5vaylzaG93VG9hc3QoJ+uzgOqyvSDsi6TtjKgnLCdpbmZvJyk7CiAgfSkudXBkYXRlU2luZ2xlT3JkZXJTdGF0dXMocm93LGZpZWxkLHZhbHVlKTsKfQoKZnVuY3Rpb24gYnVsa1N0YXR1c0NoYW5nZShkYXRlLGZpZWxkLHZhbHVlKXsKICBpZighdmFsdWUpcmV0dXJuOwogIHNob3dDb25maXJtKCfsnbzqtIQg67OA6rK9JyxkYXRlKycg7KCE7LK0IOyjvOusuOydmCAnKyhmaWVsZD09PSdwYXknPyfsnoXquIjsg4Htg5wnOifstpzqs6Dsg4Htg5wnKSsn66W8IFsnK3ZhbHVlKydd66GcIOuzgOqyve2VmOyLnOqyoOyKteuLiOq5jD8nLGZ1bmN0aW9uKCl7CiAgICBzaG93TG9hZGluZygpOwogICAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpe2hpZGVMb2FkaW5nKCk7CiAgICAgIGlmKHIub2spe2xvYWRSZWNlbnRPcmRlcnMoKX1lbHNlIHNob3dUb2FzdChyLm1zZ3x8J+yYpOulmCcsJ2Vycm9yJyk7CiAgICB9KS5idWxrVXBkYXRlT3JkZXJTdGF0dXMoZGF0ZSxmaWVsZCx2YWx1ZSk7CiAgfSk7Cn0KCnZhciBjb25maXJtQ2FsbGJhY2s9bnVsbDsKZnVuY3Rpb24gc2hvd0NvbmZpcm0odGl0bGUsbXNnLGNiKXsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybVRpdGxlJykudGV4dENvbnRlbnQ9dGl0bGU7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm1Nc2cnKS50ZXh0Q29udGVudD1tc2c7CiAgY29uZmlybUNhbGxiYWNrPWNiOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtTW9kYWwnKS5jbGFzc0xpc3QuYWRkKCdzaG93Jyk7Cn0KZnVuY3Rpb24gY29uZmlybUFjdGlvbihvayl7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm1Nb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKTsKICBpZihvayYmY29uZmlybUNhbGxiYWNrKWNvbmZpcm1DYWxsYmFjaygpOwogIGNvbmZpcm1DYWxsYmFjaz1udWxsOwp9CgpmdW5jdGlvbiByZXNldE9yZGVycygpewogIHNob3dMb2FkaW5nKCfstIjquLDtmZQg7KSRLi4uJyk7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpe2hpZGVMb2FkaW5nKCk7CiAgICBpZihyLm9rKXtsb2FkUmVjZW50T3JkZXJzKCl9ZWxzZSBzaG93VG9hc3Qoci5tc2d8fCfsmKTrpZgnLCdlcnJvcicpCiAgfSkud2l0aEZhaWx1cmVIYW5kbGVyKGZ1bmN0aW9uKGUpe2hpZGVMb2FkaW5nKCk7c2hvd1RvYXN0KGUubWVzc2FnZSwnZXJyb3InKX0pLnJlc2V0T3JkZXJIaXN0b3J5KCk7Cn0KCmZ1bmN0aW9uIGRlbGV0ZU9yZGVyQmF0Y2hDb25maXJtKGRhdGUsc2VsbGVyKXsKICBpZighY29uZmlybShkYXRlKycg67Cc7KO866W8IOyCreygnO2VmOyLnOqyoOyKteuLiOq5jD8nKSlyZXR1cm47CiAgc2hvd0xvYWRpbmcoJ+yCreygnCDspJEuLi4nKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7aGlkZUxvYWRpbmcoKTsKICAgIGlmKHIub2spe2xvYWRSZWNlbnRPcmRlcnMoKX1lbHNlIHNob3dUb2FzdChyLm1zZ3x8J+yYpOulmCcsJ2Vycm9yJykKICB9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oZSl7aGlkZUxvYWRpbmcoKTtzaG93VG9hc3QoZS5tZXNzYWdlLCdlcnJvcicpfSkuZGVsZXRlT3JkZXJCYXRjaChkYXRlLHNlbGxlcik7Cn0KCmZ1bmN0aW9uIHBlcmZRdWljayhwZXJpb2QpewogIHZhciB0bz1uZXcgRGF0ZSgpOwogIHZhciBmcm9tPW5ldyBEYXRlKCk7CiAgaWYocGVyaW9kPT09J3dlZWsnKWZyb20uc2V0RGF0ZShmcm9tLmdldERhdGUoKS03KTsKICBlbHNlIGlmKHBlcmlvZD09PSdtb250aCcpZnJvbS5zZXRNb250aChmcm9tLmdldE1vbnRoKCktMSk7CiAgZWxzZXtmcm9tPW5ldyBEYXRlKCcyMDIwLTAxLTAxJyl9CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BlcmZGcm9tJykudmFsdWU9ZnJvbS50b0lTT1N0cmluZygpLnN1YnN0cmluZygwLDEwKTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGVyZlRvJykudmFsdWU9dG8udG9JU09TdHJpbmcoKS5zdWJzdHJpbmcoMCwxMCk7CiAgbG9hZFBlcmZvcm1hbmNlKCk7Cn0KCnZhciBjYWxZZWFyLGNhbE1vbnRoLGNhbFNjaGVkdWxlcz17fSxhbGxTY2hlZHVsZUl0ZW1zPVtdLHNlbGVjdGVkQ2FsRGF0ZT0nJyxzZWxlY3RlZFBsYWNlPSfsiojtjbzrrLTsp4Qg64yA6rWs7KCQJzsKdmFyIFBMQUNFX0NPTE9SUz17J+yKiO2NvOustOynhCDrjIDqtazsoJAnOicjZGMyNjI2Jywn7IqI7Y2866y07KeEIOuqheuPmeygkCc6JyMzYjgyZjYnLCfsiojtjbzrrLTsp4Qg6rCV64+Z7KCQJzonIzhiNWNmNid9Owp2YXIgUExBQ0VfQkc9eyfsiojtjbzrrLTsp4Qg64yA6rWs7KCQJzonI2ZlZjJmMicsJ+yKiO2NvOustOynhCDrqoXrj5nsoJAnOicjZWZmNmZmJywn7IqI7Y2866y07KeEIOqwleuPmeygkCc6JyNmNWYzZmYnfTsKCmZ1bmN0aW9uIHBpY2tQbGFjZShidG4pewogIHNlbGVjdGVkUGxhY2U9YnRuLmdldEF0dHJpYnV0ZSgnZGF0YS1wbGFjZScpOwogIHZhciBidG5zPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGFjZUJ1dHRvbnMnKS5jaGlsZHJlbjsKICBmb3IodmFyIGk9MDtpPGJ0bnMubGVuZ3RoO2krKyl7CiAgICB2YXIgYmM9YnRuc1tpXS5nZXRBdHRyaWJ1dGUoJ2RhdGEtY29sb3InKTsKICAgIHZhciBpc1NlbD1idG5zW2ldPT09YnRuOwogICAgYnRuc1tpXS5zdHlsZS5ib3JkZXJDb2xvcj1pc1NlbD9iYzonI2UyZThmMCc7CiAgICBidG5zW2ldLnN0eWxlLmJhY2tncm91bmQ9aXNTZWw/KFBMQUNFX0JHW2J0bnNbaV0uZ2V0QXR0cmlidXRlKCdkYXRhLXBsYWNlJyldfHwnI2ZmZicpOicjZmZmJzsKICAgIGJ0bnNbaV0uc3R5bGUuY29sb3I9aXNTZWw/YmM6JyM2NDc0OGInOwogIH0KfQpmdW5jdGlvbiBpbml0Q2FsZW5kYXIoKXt2YXIgZD1uZXcgRGF0ZSgpO2NhbFllYXI9ZC5nZXRGdWxsWWVhcigpO2NhbE1vbnRoPWQuZ2V0TW9udGgoKTtyZW5kZXJDYWxlbmRhcigpfQpmdW5jdGlvbiBjaGFuZ2VNb250aChkaXIpe2NhbE1vbnRoKz1kaXI7aWYoY2FsTW9udGg+MTEpe2NhbE1vbnRoPTA7Y2FsWWVhcisrfWlmKGNhbE1vbnRoPDApe2NhbE1vbnRoPTExO2NhbFllYXItLX1yZW5kZXJDYWxlbmRhcigpO2xvYWRTY2hlZHVsZURhdGEoKX0KCmZ1bmN0aW9uIHJlbmRlckNhbGVuZGFyKCl7CiAgdmFyIG1vbnRocz1bJzHsm5QnLCcy7JuUJywnM+yblCcsJzTsm5QnLCc17JuUJywnNuyblCcsJzfsm5QnLCc47JuUJywnOeyblCcsJzEw7JuUJywnMTHsm5QnLCcxMuyblCddOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYWxNb250aExhYmVsJykudGV4dENvbnRlbnQ9Y2FsWWVhcisn64WEICcrbW9udGhzW2NhbE1vbnRoXTsKICB2YXIgZmlyc3Q9bmV3IERhdGUoY2FsWWVhcixjYWxNb250aCwxKS5nZXREYXkoKTsKICB2YXIgbGFzdD1uZXcgRGF0ZShjYWxZZWFyLGNhbE1vbnRoKzEsMCkuZ2V0RGF0ZSgpOwogIHZhciBub3c9bmV3IERhdGUoKTt2YXIgdHk9bm93LmdldEZ1bGxZZWFyKCksdG09bm93LmdldE1vbnRoKCkrMSx0ZD1ub3cuZ2V0RGF0ZSgpOwogIHZhciB0b2RheVN0cj10eSsnLScrKHRtPDEwPycwJyt0bTp0bSkrJy0nKyh0ZDwxMD8nMCcrdGQ6dGQpOwogIHZhciBnPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYWxHcmlkJyk7Zy5zdHlsZS5kaXNwbGF5PSdncmlkJztnLnN0eWxlLmdyaWRUZW1wbGF0ZUNvbHVtbnM9J3JlcGVhdCg3LDFmciknO2cuc3R5bGUuZ2FwPSczcHgnOwogIHZhciBoPScnOwogIGZvcih2YXIgaT0wO2k8Zmlyc3Q7aSsrKWgrPSc8ZGl2IHN0eWxlPSJtaW4taGVpZ2h0OjgwcHgiPjwvZGl2Pic7CiAgZm9yKHZhciBkPTE7ZDw9bGFzdDtkKyspewogICAgdmFyIG1tPWNhbE1vbnRoKzEsZGQ9ZDsKICAgIHZhciBkcz1jYWxZZWFyKyctJysobW08MTA/JzAnK21tOm1tKSsnLScrKGRkPDEwPycwJytkZDpkZCk7CiAgICB2YXIgaXNUb2RheT0oZHM9PT10b2RheVN0ciksaXNTZWw9KGRzPT09c2VsZWN0ZWRDYWxEYXRlKTsKICAgIHZhciBldmVudHM9Y2FsU2NoZWR1bGVzW2RzXXx8W107CiAgICB2YXIgZXZIPScnOwogICAgZm9yKHZhciBlaT0wO2VpPGV2ZW50cy5sZW5ndGgmJmVpPDI7ZWkrKyl7CiAgICAgIHZhciBldj1ldmVudHNbZWldLHBjPVBMQUNFX0NPTE9SU1tldi5wbGFjZV18fCcjODg4Jyx0U2hvcnQ9U3RyaW5nKGV2LnRpbWV8fCcnKS5zdWJzdHJpbmcoMCw1KTsKICAgICAgaWYoZXYuc3RhdHVzPT09J+2ZleyglScpZXZIKz0nPGRpdiBzdHlsZT0iZm9udC1zaXplOjhweDtiYWNrZ3JvdW5kOicrcGMrJztjb2xvcjojZmZmO2JvcmRlci1yYWRpdXM6NHB4O3BhZGRpbmc6MnB4IDRweDttYXJnaW4tdG9wOjJweDtvdmVyZmxvdzpoaWRkZW47d2hpdGUtc3BhY2U6bm93cmFwO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7Zm9udC13ZWlnaHQ6NjAwIj4nK2V2LnNlbGxlcisnICcrdFNob3J0Kyc8L2Rpdj4nOwogICAgICBlbHNlIGV2SCs9JzxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo4cHg7Ym9yZGVyOjEuNXB4IHNvbGlkICcrcGMrJztjb2xvcjonK3BjKyc7Ym9yZGVyLXJhZGl1czo0cHg7cGFkZGluZzoxcHggM3B4O21hcmdpbi10b3A6MnB4O292ZXJmbG93OmhpZGRlbjt3aGl0ZS1zcGFjZTpub3dyYXA7dGV4dC1vdmVyZmxvdzplbGxpcHNpcztmb250LXdlaWdodDo2MDAiPicrZXYuc2VsbGVyKycgJyt0U2hvcnQrJzwvZGl2Pic7CiAgICB9CiAgICBpZihldmVudHMubGVuZ3RoPjIpZXZIKz0nPGRpdiBzdHlsZT0iZm9udC1zaXplOjhweDtjb2xvcjojODg4O21hcmdpbi10b3A6MXB4Ij4rJysoZXZlbnRzLmxlbmd0aC0yKSsnPC9kaXY+JzsKICAgIHZhciBiZz1pc1NlbD8nI2RiZWFmZSc6aXNUb2RheT8nIzBGNkU1Nic6JyNmOGZhZmMnO3ZhciBmYz1pc1RvZGF5PycjZmZmJzonIzFhMWEyZSc7dmFyIGJkPWlzU2VsPycycHggc29saWQgIzNiODJmNic6JzFweCBzb2xpZCAjZTVlN2ViJzsKICAgIGgrPSc8ZGl2IG9uY2xpY2s9InNlbGVjdENhbERhdGUoJysiJyIrZHMrIiciKycpIiBzdHlsZT0icGFkZGluZzo0cHg7Ym9yZGVyLXJhZGl1czoxMHB4O21pbi1oZWlnaHQ6ODBweDtjdXJzb3I6cG9pbnRlcjtib3JkZXI6JytiZCsnO2JhY2tncm91bmQ6JytiZysnO2NvbG9yOicrZmMrJyI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwO3RleHQtYWxpZ246Y2VudGVyIj4nK2QrJzwvZGl2PicrZXZIKyc8L2Rpdj4nOwogIH0KICBnLmlubmVySFRNTD1oOwp9CmZ1bmN0aW9uIHNlbGVjdENhbERhdGUoZHMpe3NlbGVjdGVkQ2FsRGF0ZT1kcztkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NoZWR1bGVEYXRlJykudGV4dENvbnRlbnQ9J/Cfk4UgJytkcysnIOuwqeyGoSDsi6Dssq0nO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY2hlZHVsZVJlcXVlc3RDYXJkJykuc3R5bGUuZGlzcGxheT0nYmxvY2snO3JlbmRlckNhbGVuZGFyKCk7bG9hZFNjaGVkdWxlTGlzdCgpfQoKZnVuY3Rpb24gc3VibWl0U2NoZWR1bGUoKXsKICB2YXIgdGltZT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc0FQMScpLnZhbHVlKycgJytkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc0gxJykudmFsdWUrJ+yLnCAnK2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzTTEnKS52YWx1ZSsn67aEIH4gJytkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc0FQMicpLnZhbHVlKycgJytkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc0gyJykudmFsdWUrJ+yLnCAnK2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzTTInKS52YWx1ZSsn67aEJzsKICB2YXIgbWVtbz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NoZWRNZW1vJykudmFsdWU7CiAgc2hvd0xvYWRpbmcoJ+ydvOyglSDrk7HroZ0g7KSRLi4uJyk7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpe2hpZGVMb2FkaW5nKCk7aWYoci5vayl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjaGVkTWVtbycpLnZhbHVlPScnO2xvYWRTY2hlZHVsZURhdGEoKX1lbHNlIHNob3dUb2FzdChyLm1zZ3x8J+yYpOulmCcsJ2Vycm9yJyl9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oZSl7aGlkZUxvYWRpbmcoKTtzaG93VG9hc3QoZS5tZXNzYWdlLCJlcnJvciIpfSkuYWRkQnJvYWRjYXN0U2NoZWR1bGUoc2VsZWN0ZWRDYWxEYXRlLHNlbGVjdGVkUGxhY2UsdGltZSxtZW1vLGN1cnJlbnRVc2VyLm5hbWUsY3VycmVudFVzZXIucm9sZSk7Cn0KCmZ1bmN0aW9uIGxvYWRTY2hlZHVsZURhdGEoKXsKICB2YXIgeW09Y2FsWWVhcisnLScrKGNhbE1vbnRoKzE8MTA/JzAnKyhjYWxNb250aCsxKTooY2FsTW9udGgrMSkpOwogIHNob3dMb2FkaW5nKCk7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpewogICAgaGlkZUxvYWRpbmcoKTthbGxTY2hlZHVsZUl0ZW1zPXJ8fFtdO2NhbFNjaGVkdWxlcz17fTsKICAgIGlmKHImJnIubGVuZ3RoKXtmb3IodmFyIGk9MDtpPHIubGVuZ3RoO2krKyl7dmFyIHM9cltpXTtpZighY2FsU2NoZWR1bGVzW3MuZGF0ZV0pY2FsU2NoZWR1bGVzW3MuZGF0ZV09W107Y2FsU2NoZWR1bGVzW3MuZGF0ZV0ucHVzaChzKX19CiAgICByZW5kZXJDYWxlbmRhcigpO2lmKHNlbGVjdGVkQ2FsRGF0ZSlsb2FkU2NoZWR1bGVMaXN0KCk7CiAgICByZW5kZXJVcGNvbWluZyhyKTtyZW5kZXJQZW5kaW5nUmVxdWVzdHMocik7cmVuZGVyTXlSZXF1ZXN0cyhyKTsKICB9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oZSl7aGlkZUxvYWRpbmcoKX0pLmdldE1vbnRoU2NoZWR1bGVzKHltLGN1cnJlbnRVc2VyLnJvbGUsY3VycmVudFVzZXIubmFtZSk7Cn0KCmZ1bmN0aW9uIHJlbmRlclVwY29taW5nKGl0ZW1zKXsKICB2YXIgY2FyZD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXBjb21pbmdDYXJkJyk7CiAgaWYoIWl0ZW1zfHwhaXRlbXMubGVuZ3RoKXtjYXJkLnN0eWxlLmRpc3BsYXk9J25vbmUnO3JldHVybn0KICB2YXIgbm93PW5ldyBEYXRlKCk7dmFyIHR5PW5vdy5nZXRGdWxsWWVhcigpLHRtPW5vdy5nZXRNb250aCgpKzEsdGQ9bm93LmdldERhdGUoKTsKICB2YXIgdG9kYXlTdHI9dHkrJy0nKyh0bTwxMD8nMCcrdG06dG0pKyctJysodGQ8MTA/JzAnK3RkOnRkKTsKICB2YXIgbXlOYW1lPWN1cnJlbnRVc2VyP2N1cnJlbnRVc2VyLm5hbWU6Jyc7CiAgdmFyIGlzQWRtPWN1cnJlbnRVc2VyJiYoY3VycmVudFVzZXIucm9sZT09PSfrp4jsiqTthLAnfHxjdXJyZW50VXNlci5yb2xlPT09J+u2gOuniOyKpO2EsCd8fGN1cnJlbnRVc2VyLnJvbGU9PT0n6rSA66as7J6QJyk7CiAgdmFyIHVwY29taW5nPVtdOwogIGZvcih2YXIgaT0wO2k8aXRlbXMubGVuZ3RoO2krKyl7CiAgICB2YXIgcz1pdGVtc1tpXTsKICAgIGlmKHMuc3RhdHVzPT09J+2ZleyglScmJnMuZGF0ZT49dG9kYXlTdHIpewogICAgICB2YXIgc0RhdGU9bmV3IERhdGUocy5kYXRlKydUMDA6MDA6MDAnKTsKICAgICAgdmFyIGRpZmY9TWF0aC5jZWlsKChzRGF0ZS1ub3cpLygxMDAwKjYwKjYwKjI0KSk7CiAgICAgIGlmKGRpZmY+Nyljb250aW51ZTsKICAgICAgaWYoaXNBZG18fHMuc2VsbGVyPT09bXlOYW1lKXtzLl9kaWZmPWRpZmY7dXBjb21pbmcucHVzaChzKX0KICAgIH0KICB9CiAgdXBjb21pbmcuc29ydChmdW5jdGlvbihhLGIpe3JldHVybiBhLmRhdGUubG9jYWxlQ29tcGFyZShiLmRhdGUpfSk7CiAgaWYoIXVwY29taW5nLmxlbmd0aCl7Y2FyZC5zdHlsZS5kaXNwbGF5PSdub25lJztyZXR1cm59CiAgY2FyZC5zdHlsZS5kaXNwbGF5PSdibG9jayc7CiAgdmFyIGg9JzxkaXYgc3R5bGU9Im1heC1oZWlnaHQ6MjgwcHg7b3ZlcmZsb3cteTphdXRvO3BhZGRpbmctcmlnaHQ6NHB4Ij4nOwogIGZvcih2YXIgaT0wO2k8dXBjb21pbmcubGVuZ3RoO2krKyl7CiAgICB2YXIgcz11cGNvbWluZ1tpXTsKICAgIHZhciBwYz1QTEFDRV9DT0xPUlNbcy5wbGFjZV18fCcjNGFkZTgwJzsKICAgIHZhciBkaWZmPXMuX2RpZmY7CiAgICB2YXIgZGRheT1kaWZmPD0wPydELURBWSc6J0QtJytkaWZmOwogICAgdmFyIGRkYXlCZz1kaWZmPD0wPycjZGMyNjI2JzpkaWZmPD0zPycjZjU5ZTBiJzonIzRhZGU4MCc7CiAgICB2YXIgcGxhY2VOYW1lPVN0cmluZyhzLnBsYWNlfHwnJykucmVwbGFjZSgn7IqI7Y2866y07KeEICcsJycpOwogICAgaCs9JzxkaXYgc3R5bGU9Im1hcmdpbi1ib3R0b206NnB4Ij4nCiAgICAgICsnPGRpdiBvbmNsaWNrPSJ0b2dnbGVVcGNvbWluZ0RldGFpbCh0aGlzKSIgc3R5bGU9ImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHg7cGFkZGluZzoxMnB4O2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDgpO2JvcmRlci1yYWRpdXM6MTBweDtjdXJzb3I6cG9pbnRlciI+JwogICAgICArJzxkaXYgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO21pbi13aWR0aDo1MnB4Ij48ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA4cHg7Ym9yZGVyLXJhZGl1czo2cHg7YmFja2dyb3VuZDonK2RkYXlCZysnO2NvbG9yOiNmZmY7Zm9udC13ZWlnaHQ6NzAwIj4nK2RkYXkrJzwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM5NGEzYjg7bWFyZ2luLXRvcDo0cHgiPicrcy5kYXRlLnN1YnN0cmluZyg1KSsnPC9kaXY+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6MCI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNmZmYiPicrcy5zZWxsZXIrJzwvZGl2PicKICAgICAgKyhzLmFkbWluPyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojOTRhM2I4O21hcmdpbi10b3A6MXB4Ij7shozsho06ICcrcy5hZG1pbisnPC9kaXY+JzonJykKICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtjb2xvcjojOTRhM2I4O21hcmdpbi10b3A6MnB4Ij4nK3MudGltZSsnPC9kaXY+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDEwcHg7Ym9yZGVyLXJhZGl1czo2cHg7YmFja2dyb3VuZDonK3BjKyc7Y29sb3I6I2ZmZjtmb250LXdlaWdodDo2MDAiPicrcGxhY2VOYW1lKyc8L2Rpdj48L2Rpdj4nCiAgICAgICsnPC9kaXY+JwogICAgICArJzxkaXYgY2xhc3M9InVwY29taW5nLWRldGFpbCIgc3R5bGU9ImRpc3BsYXk6bm9uZTtwYWRkaW5nOjEwcHggMTJweDtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA1KTtib3JkZXItcmFkaXVzOjAgMCAxMHB4IDEwcHg7bWFyZ2luLXRvcDotNHB4IiBkYXRhLXNlbGxlcj0iJytzLnNlbGxlcisnIj48L2Rpdj4nCiAgICAgICsnPC9kaXY+JzsKICB9CiAgaCs9JzwvZGl2Pic7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwY29taW5nTGlzdCcpLmlubmVySFRNTD1oOwp9CgpmdW5jdGlvbiB0b2dnbGVVcGNvbWluZ0RldGFpbChlbCl7CiAgdmFyIGRldGFpbD1lbC5uZXh0RWxlbWVudFNpYmxpbmc7CiAgaWYoIWRldGFpbClyZXR1cm47CiAgaWYoZGV0YWlsLnN0eWxlLmRpc3BsYXk9PT0nYmxvY2snKXtkZXRhaWwuc3R5bGUuZGlzcGxheT0nbm9uZSc7cmV0dXJufQogIHZhciBzZWxsZXI9ZGV0YWlsLmdldEF0dHJpYnV0ZSgnZGF0YS1zZWxsZXInKTsKICBpZihkZXRhaWwuaW5uZXJIVE1MKXtkZXRhaWwuc3R5bGUuZGlzcGxheT0nYmxvY2snO3JldHVybn0KICBkZXRhaWwuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPSJjb2xvcjojOTRhM2I4O2ZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6NHB4Ij7roZzrlKnspJEuLi48L2Rpdj4nOwogIGRldGFpbC5zdHlsZS5kaXNwbGF5PSdibG9jayc7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKHIpewogICAgaWYoIXIub2spe2RldGFpbC5pbm5lckhUTUw9JzxkaXYgc3R5bGU9ImNvbG9yOiM5NGEzYjg7Zm9udC1zaXplOjExcHgiPuygleuztCDsl4bsnYw8L2Rpdj4nO3JldHVybn0KICAgIHZhciBwPXIucHJvZmlsZSxzPXIuc3RhdHM7CiAgICB2YXIgcmF0ZT1zLnRvdGFsU2FsZXM+MD9NYXRoLnJvdW5kKHMudG90YWxNYXJnaW4vcy50b3RhbFNhbGVzKjEwMCk6MDsKICAgIGRldGFpbC5pbm5lckhUTUw9JzxkaXYgc3R5bGU9ImRpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmcjtnYXA6NnB4O21hcmdpbi1ib3R0b206OHB4Ij4nCiAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjExcHg7Y29sb3I6Izk0YTNiOCI+7Jew65297LKYOiA8c3BhbiBzdHlsZT0iY29sb3I6I2UyZThmMCI+JysocC5waG9uZXx8Jy0nKSsnPC9zcGFuPjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojOTRhM2I4Ij7snbTrqZTsnbw6IDxzcGFuIHN0eWxlPSJjb2xvcjojZTJlOGYwIj4nKyhwLmVtYWlsfHwnLScpKyc8L3NwYW4+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM5NGEzYjgiPuyXheyytDogPHNwYW4gc3R5bGU9ImNvbG9yOiNlMmU4ZjAiPicrKHAuY29tcGFueXx8Jy0nKSsnPC9zcGFuPjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojOTRhM2I4Ij7ssYTrhJA6IDxzcGFuIHN0eWxlPSJjb2xvcjojZTJlOGYwIj4nKyhwLmNoYW5uZWxzfHwnLScpKyc8L3NwYW4+PC9kaXY+JwogICAgICArJzwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyIDFmcjtnYXA6NHB4Ij4nCiAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDE1LDExMCw4NiwuMyk7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo4cHg7Y29sb3I6Izk0YTNiOCI+66ek7LacPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiM0YWRlODAiPuKCqScrZm10KHMudG90YWxTYWxlcykrJzwvZGl2PjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOnJnYmEoMjQ1LDE1OCwxMSwuMik7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo4cHg7Y29sb3I6Izk0YTNiOCI+66eI7KeEPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNmYmJmMjQiPuKCqScrZm10KHMudG90YWxNYXJnaW4pKyc8L2Rpdj48L2Rpdj4nCiAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wNSk7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo4cHg7Y29sb3I6Izk0YTNiOCI+7IiY7J2166WgPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOicrKHJhdGU+PTMwPycjNGFkZTgwJzpyYXRlPj0xNT8nI2ZiYmYyNCc6JyNmODcxNzEnKSsnIj4nK3JhdGUrJyU8L2Rpdj48L2Rpdj4nCiAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wNSk7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo4cHg7Y29sb3I6Izk0YTNiOCI+67Cc7KO8PC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNlMmU4ZjAiPicrcy50b3RhbE9yZGVycysn6rG0PC9kaXY+PC9kaXY+JwogICAgICArJzwvZGl2Pic7CiAgfSkuZ2V0U2VsbGVyUHJvZmlsZUFuZFN0YXRzKHNlbGxlcik7Cn0KCmZ1bmN0aW9uIHJlbmRlck15UmVxdWVzdHMoaXRlbXMpewogIHZhciBpc1NlbGxlcj1jdXJyZW50VXNlciYmY3VycmVudFVzZXIucm9sZT09PSfshYDrn6wnOwogIHZhciBjYXJkPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdteVJlcXVlc3RzQ2FyZCcpOwogIGlmKCFpc1NlbGxlcil7Y2FyZC5zdHlsZS5kaXNwbGF5PSdub25lJztyZXR1cm59CiAgdmFyIG15TmFtZT1jdXJyZW50VXNlci5uYW1lOwogIHZhciBteUl0ZW1zPVtdOwogIGlmKGl0ZW1zKWZvcih2YXIgaT0wO2k8aXRlbXMubGVuZ3RoO2krKyl7aWYoaXRlbXNbaV0uc2VsbGVyPT09bXlOYW1lKW15SXRlbXMucHVzaChpdGVtc1tpXSl9CiAgaWYoIW15SXRlbXMubGVuZ3RoKXtjYXJkLnN0eWxlLmRpc3BsYXk9J25vbmUnO3JldHVybn0KICBjYXJkLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJzsKICBteUl0ZW1zLnNvcnQoZnVuY3Rpb24oYSxiKXtyZXR1cm4gYi5kYXRlLmxvY2FsZUNvbXBhcmUoYS5kYXRlKX0pOwogIHZhciBoPScnOwogIGZvcih2YXIgaT0wO2k8bXlJdGVtcy5sZW5ndGg7aSsrKXsKICAgIHZhciBzPW15SXRlbXNbaV0scGM9UExBQ0VfQ09MT1JTW3MucGxhY2VdfHwnIzg4OCcscGJnPVBMQUNFX0JHW3MucGxhY2VdfHwnI2Y4ZmFmYyc7CiAgICB2YXIgaXNDb25mPXMuc3RhdHVzPT09J+2ZleyglSc7CiAgICB2YXIgcGxhY2VOYW1lPVN0cmluZyhzLnBsYWNlfHwnJykucmVwbGFjZSgn7IqI7Y2866y07KeEICcsJycpOwogICAgaCs9JzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEwcHg7cGFkZGluZzoxMHB4IDEycHg7YmFja2dyb3VuZDonK3BiZysnO2JvcmRlci1sZWZ0OjNweCBzb2xpZCAnK3BjKyc7Ym9yZGVyLXJhZGl1czowIDEwcHggMTBweCAwO21hcmdpbi1ib3R0b206NnB4Ij4nCiAgICAgICsnPGRpdiBzdHlsZT0ibWluLXdpZHRoOjcwcHgiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjonK3BjKyciPicrcy5kYXRlLnN1YnN0cmluZyg1KSsnPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Y29sb3I6Izg4ODttYXJnaW4tdG9wOjJweCI+JytwbGFjZU5hbWUrJzwvZGl2PjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJmbGV4OjE7bWluLXdpZHRoOjAiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiMzMzQxNTUiPicrcy50aW1lKyc8L2Rpdj4nCiAgICAgICsocy5tZW1vPyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojODg4O21hcmdpbi10b3A6MnB4Ij4nK3MubWVtbysnPC9kaXY+JzonJykrJzwvZGl2PicKICAgICAgKyc8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExcHg7cGFkZGluZzo0cHggMTBweDtib3JkZXItcmFkaXVzOjIwcHg7Zm9udC13ZWlnaHQ6NzAwOycrKGlzQ29uZj8nYmFja2dyb3VuZDonK3BjKyc7Y29sb3I6I2ZmZic6J2JvcmRlcjoycHggc29saWQgJytwYysnO2NvbG9yOicrcGMpKyciPicrcy5zdGF0dXMrJzwvc3Bhbj4nCiAgICAgICsnPC9kaXY+JzsKICB9CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215UmVxdWVzdHNMaXN0JykuaW5uZXJIVE1MPWg7Cn0KCmZ1bmN0aW9uIHJlbmRlclBlbmRpbmdSZXF1ZXN0cyhpdGVtcyl7CiAgdmFyIGlzQWRtPWN1cnJlbnRVc2VyJiYoY3VycmVudFVzZXIucm9sZT09PSfrp4jsiqTthLAnfHxjdXJyZW50VXNlci5yb2xlPT09J+u2gOuniOyKpO2EsCd8fGN1cnJlbnRVc2VyLnJvbGU9PT0n6rSA66as7J6QJyk7CiAgdmFyIGNhcmQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BlbmRpbmdSZXF1ZXN0c0NhcmQnKTsKICBpZighaXNBZG0pe2NhcmQuc3R5bGUuZGlzcGxheT0nbm9uZSc7cmV0dXJufQogIHZhciBwZW5kaW5nPVtdO2lmKGl0ZW1zKWZvcih2YXIgaT0wO2k8aXRlbXMubGVuZ3RoO2krKyl7aWYoaXRlbXNbaV0uc3RhdHVzPT09J+yalOyyrScpcGVuZGluZy5wdXNoKGl0ZW1zW2ldKX0KICBpZighcGVuZGluZy5sZW5ndGgpe2NhcmQuc3R5bGUuZGlzcGxheT0nbm9uZSc7cmV0dXJufQogIGNhcmQuc3R5bGUuZGlzcGxheT0nYmxvY2snO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZW5kaW5nQ291bnQnKS50ZXh0Q29udGVudD1wZW5kaW5nLmxlbmd0aCsn6rG0JzsKICB2YXIgaD0nJzsKICBmb3IodmFyIGk9MDtpPHBlbmRpbmcubGVuZ3RoO2krKyl7CiAgICB2YXIgcz1wZW5kaW5nW2ldLHBjPVBMQUNFX0NPTE9SU1tzLnBsYWNlXXx8JyM4ODgnLHBiZz1QTEFDRV9CR1tzLnBsYWNlXXx8JyNmOGZhZmMnLHBsYWNlTmFtZT1TdHJpbmcocy5wbGFjZXx8JycpLnJlcGxhY2UoJ+yKiO2NvOustOynhCAnLCcnKTsKICAgIGgrPSc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOicrcGJnKyc7Ym9yZGVyLWxlZnQ6M3B4IHNvbGlkICcrcGMrJztib3JkZXItcmFkaXVzOjAgMTBweCAxMHB4IDA7cGFkZGluZzoxNHB4O21hcmdpbi1ib3R0b206OHB4Ij4nCiAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQiPicKICAgICAgKyc8ZGl2IHN0eWxlPSJmbGV4OjE7Y3Vyc29yOnBvaW50ZXIiIG9uY2xpY2s9InNob3dTZWxsZXJQcm9maWxlKCcrIiciK3Muc2VsbGVyKyInIisnKSI+JwogICAgICArJzxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTVweDtjb2xvcjonK3BjKyciPicrcy5zZWxsZXIrJyA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExcHg7Y29sb3I6Izg4ODtmb250LXdlaWdodDo0MDAiPuygleuztOuztOq4sCDilrg8L3NwYW4+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiMzMzQxNTU7bWFyZ2luLXRvcDozcHgiPicrcy5kYXRlKycgwrcgJytzLnRpbWUrJzwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojNjQ3NDhiO21hcmdpbi10b3A6MnB4Ij7wn5ONICcrcGxhY2VOYW1lKyhzLm1lbW8/JyDCtyAnK3MubWVtbzonJykrJzwvZGl2PjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo0cHg7ZmxleC1zaHJpbms6MCI+JwogICAgICArJzxidXR0b24gb25jbGljaz0iY29uZmlybVNjaGVkdWxlKCcrcy5yb3crJykiIHN0eWxlPSJwYWRkaW5nOjdweCAxNHB4O2JhY2tncm91bmQ6JytwYysnO2NvbG9yOiNmZmY7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czo4cHg7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NzAwO2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQiPu2ZleyglTwvYnV0dG9uPicKICAgICAgKyc8YnV0dG9uIG9uY2xpY2s9ImNoYW5nZVNjaGVkdWxlRGF0ZSgnK3Mucm93KycsJysiJyIrcy5kYXRlKyInIisnKSIgc3R5bGU9InBhZGRpbmc6N3B4IDE0cHg7YmFja2dyb3VuZDojM2I4MmY2O2NvbG9yOiNmZmY7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czo4cHg7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NzAwO2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQiPuuCoOynnOuzgOqyvTwvYnV0dG9uPicKICAgICAgKyc8YnV0dG9uIG9uY2xpY2s9ImNhbmNlbFNjaGVkdWxlKCcrcy5yb3crJykiIHN0eWxlPSJwYWRkaW5nOjdweCAxNHB4O2JhY2tncm91bmQ6I2ZmZjtjb2xvcjojZGMyNjI2O2JvcmRlcjoxcHggc29saWQgI2RjMjYyNjtib3JkZXItcmFkaXVzOjhweDtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo3MDA7Y3Vyc29yOnBvaW50ZXI7Zm9udC1mYW1pbHk6aW5oZXJpdCI+7Leo7IaMPC9idXR0b24+JwogICAgICArJzwvZGl2PjwvZGl2PicKICAgICAgKyc8ZGl2IGlkPSJzZWxsZXJQcm9maWxlXycrcy5yb3crJyIgc3R5bGU9ImRpc3BsYXk6bm9uZTttYXJnaW4tdG9wOjEwcHg7cGFkZGluZy10b3A6MTBweDtib3JkZXItdG9wOjFweCBkYXNoZWQgJytwYysnIj48L2Rpdj4nCiAgICAgICsnPC9kaXY+JzsKICB9CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BlbmRpbmdMaXN0JykuaW5uZXJIVE1MPWg7Cn0KCmZ1bmN0aW9uIGNhbmNlbFNjaGVkdWxlKHJvdyl7CiAgc2hvd0NvbmZpcm0oJ+uwqeyGoSDst6jshownLCfsnbQg67Cp7IahIOyLoOyyreydhCDst6jshoztlZjsi5zqsqDsirXri4jquYw/JyxmdW5jdGlvbigpewogICAgc2hvd0xvYWRpbmcoKTsKICAgIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihyKXtoaWRlTG9hZGluZygpO2lmKHIub2spbG9hZFNjaGVkdWxlRGF0YSgpO2Vsc2Ugc2hvd1RvYXN0KHIubXNnfHwn7Jik66WYJywnZXJyb3InKX0pLndpdGhGYWlsdXJlSGFuZGxlcihmdW5jdGlvbigpe2hpZGVMb2FkaW5nKCl9KS5jYW5jZWxCcm9hZGNhc3RTY2hlZHVsZShyb3cpOwogIH0pOwp9Cgp2YXIgX2RhdGVDaGFuZ2VSb3c9MDsKZnVuY3Rpb24gY2hhbmdlU2NoZWR1bGVEYXRlKHJvdyxjdXJyZW50RGF0ZSl7CiAgX2RhdGVDaGFuZ2VSb3c9cm93OwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkYXRlQ2hhbmdlSW5wdXQnKS52YWx1ZT1jdXJyZW50RGF0ZTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGF0ZUNoYW5nZU1vZGFsJykuY2xhc3NMaXN0LmFkZCgnc2hvdycpOwp9CmZ1bmN0aW9uIGNsb3NlRGF0ZUNoYW5nZSgpe2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkYXRlQ2hhbmdlTW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCdzaG93Jyl9CmZ1bmN0aW9uIGRvRGF0ZUNoYW5nZSgpewogIHZhciBuZXdEYXRlPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkYXRlQ2hhbmdlSW5wdXQnKS52YWx1ZTsKICBpZighbmV3RGF0ZSl7c2hvd1RvYXN0KCfrgqDsp5zrpbwg7ISg7YOd7ZWY7IS47JqUJywnZXJyb3InKTtyZXR1cm59CiAgdmFyIG5ld1RpbWU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RjQVAxJykudmFsdWUrJyAnK2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkY0gxJykudmFsdWUrJ+yLnCAnK2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkY00xJykudmFsdWUrJ+u2hCB+ICcrZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RjQVAyJykudmFsdWUrJyAnK2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkY0gyJykudmFsdWUrJ+yLnCAnK2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkY00yJykudmFsdWUrJ+u2hCc7CiAgY2xvc2VEYXRlQ2hhbmdlKCk7CiAgc2hvd0xvYWRpbmcoKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7aGlkZUxvYWRpbmcoKTtpZihyLm9rKXtsb2FkU2NoZWR1bGVEYXRhKCk7c2hvd1RvYXN0KCfsnbzsoJXsnbQg67OA6rK965CY7JeI7Iq164uI64ukJywnc3VjY2VzcycpfWVsc2Ugc2hvd1RvYXN0KHIubXNnfHwn7Jik66WYJywnZXJyb3InKX0pLndpdGhGYWlsdXJlSGFuZGxlcihmdW5jdGlvbigpe2hpZGVMb2FkaW5nKCl9KS5jaGFuZ2VCcm9hZGNhc3RTY2hlZHVsZShfZGF0ZUNoYW5nZVJvdyxuZXdEYXRlLG5ld1RpbWUpOwp9CgpmdW5jdGlvbiBzaG93U2VsbGVyUHJvZmlsZShzZWxsZXJOYW1lKXsKICBzaG93TG9hZGluZygpOwogIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihyKXsKICAgIGhpZGVMb2FkaW5nKCk7CiAgICB2YXIgZWxzPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tpZF49InNlbGxlclByb2ZpbGVfIl0nKTsKICAgIGZvcih2YXIgaT0wO2k8ZWxzLmxlbmd0aDtpKyspZWxzW2ldLnN0eWxlLmRpc3BsYXk9J25vbmUnOwogICAgaWYoIXIub2spcmV0dXJuOwogICAgdmFyIHA9ci5wcm9maWxlLHM9ci5zdGF0czsKICAgIHZhciB0YXJnZXRFbD1udWxsOwogICAgZm9yKHZhciBpPTA7aTxlbHMubGVuZ3RoO2krKyl7CiAgICAgIHZhciBwYXJlbnQ9ZWxzW2ldLnBhcmVudE5vZGU7CiAgICAgIGlmKHBhcmVudCYmcGFyZW50LmlubmVySFRNTC5pbmRleE9mKHNlbGxlck5hbWUpPj0wKXt0YXJnZXRFbD1lbHNbaV07YnJlYWt9CiAgICB9CiAgICBpZighdGFyZ2V0RWwpcmV0dXJuOwogICAgdmFyIHJhdGU9cy50b3RhbFNhbGVzPjA/TWF0aC5yb3VuZChzLnRvdGFsTWFyZ2luL3MudG90YWxTYWxlcyoxMDApOjA7CiAgICB2YXIgaD0nPGRpdiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDo4cHg7bWFyZ2luLWJvdHRvbToxMHB4Ij4nCiAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHgiPjxzcGFuIHN0eWxlPSJjb2xvcjojODg4Ij7snbTrpoQ6PC9zcGFuPiA8Yj4nK3AubmFtZSsnPC9iPjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweCI+PHNwYW4gc3R5bGU9ImNvbG9yOiM4ODgiPuyXsOudveyymDo8L3NwYW4+ICcrKHAucGhvbmV8fCctJykrJzwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweCI+PHNwYW4gc3R5bGU9ImNvbG9yOiM4ODgiPuydtOuplOydvDo8L3NwYW4+ICcrKHAuZW1haWx8fCctJykrJzwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweCI+PHNwYW4gc3R5bGU9ImNvbG9yOiM4ODgiPuyXheyytDo8L3NwYW4+ICcrKHAuY29tcGFueXx8Jy0nKSsnPC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4Ij48c3BhbiBzdHlsZT0iY29sb3I6Izg4OCI+7LGE64SQOjwvc3Bhbj4gJysocC5jaGFubmVsc3x8Jy0nKSsnPC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4Ij48c3BhbiBzdHlsZT0iY29sb3I6Izg4OCI+7JuU66ek7LacOjwvc3Bhbj4gJysocC5hdmdTYWxlc3x8Jy0nKSsnPC9kaXY+JwogICAgICArJzwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyIDFmcjtnYXA6NnB4Ij4nCiAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjBmZGY0O2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6OHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPuy0neunpOy2nDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMEY2RTU2Ij7igqknK2ZtdChzLnRvdGFsU2FsZXMpKyc8L2Rpdj48L2Rpdj4nCiAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmVmY2U4O2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6OHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPuuniOynhDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojZjU5ZTBiIj7igqknK2ZtdChzLnRvdGFsTWFyZ2luKSsnPC9kaXY+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YxZjVmOTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjhweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4Ij7siJjsnbXrpaA8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTNweDtmb250LXdlaWdodDo3MDA7Y29sb3I6JysocmF0ZT49MzA/JyMwRjZFNTYnOnJhdGU+PTE1PycjZjU5ZTBiJzonI2RjMjYyNicpKyciPicrcmF0ZSsnJTwvZGl2PjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMWY1Zjk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzo4cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+67Cc7KO8PC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMzMzQxNTUiPicrcy50b3RhbE9yZGVycysn6rG0PC9kaXY+PC9kaXY+JwogICAgICArJzwvZGl2Pic7CiAgICB0YXJnZXRFbC5pbm5lckhUTUw9aDsKICAgIHRhcmdldEVsLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJzsKICB9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oKXtoaWRlTG9hZGluZygpfSkuZ2V0U2VsbGVyUHJvZmlsZUFuZFN0YXRzKHNlbGxlck5hbWUpOwp9CgpmdW5jdGlvbiBsb2FkU2NoZWR1bGVMaXN0KCl7CiAgaWYoIXNlbGVjdGVkQ2FsRGF0ZSlyZXR1cm47dmFyIGl0ZW1zPWNhbFNjaGVkdWxlc1tzZWxlY3RlZENhbERhdGVdfHxbXTsKICB2YXIgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NjaGVkdWxlTGlzdCcpOwogIGlmKCFpdGVtcy5sZW5ndGgpe2VsLmlubmVySFRNTD0nJztyZXR1cm59CiAgdmFyIGlzQWRtPWN1cnJlbnRVc2VyJiYoY3VycmVudFVzZXIucm9sZT09PSfrp4jsiqTthLAnfHxjdXJyZW50VXNlci5yb2xlPT09J+u2gOuniOyKpO2EsCd8fGN1cnJlbnRVc2VyLnJvbGU9PT0n6rSA66as7J6QJyk7CiAgdmFyIGg9Jyc7CiAgZm9yKHZhciBpPTA7aTxpdGVtcy5sZW5ndGg7aSsrKXsKICAgIHZhciBzPWl0ZW1zW2ldLHBjPVBMQUNFX0NPTE9SU1tzLnBsYWNlXXx8JyM4ODgnLHBiZz1QTEFDRV9CR1tzLnBsYWNlXXx8JyNmOGZhZmMnLGlzQ29uZj1zLnN0YXR1cz09PSftmZXsoJUnLHBsYWNlTmFtZT1TdHJpbmcocy5wbGFjZXx8JycpLnJlcGxhY2UoJ+yKiO2NvOustOynhCAnLCcnKTsKICAgIGgrPSc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOicrcGJnKyc7Ym9yZGVyLWxlZnQ6M3B4IHNvbGlkICcrcGMrJztib3JkZXItcmFkaXVzOjAgMTBweCAxMHB4IDA7cGFkZGluZzoxNHB4O21hcmdpbi1ib3R0b206OHB4Ij48ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyIj4nCiAgICAgICsnPGRpdj48ZGl2IHN0eWxlPSJmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjE1cHg7Y29sb3I6JytwYysnIj4nK3Muc2VsbGVyKyc8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTNweDtjb2xvcjojMzM0MTU1O21hcmdpbi10b3A6M3B4Ij4nK3MudGltZSsnPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEzcHg7Y29sb3I6IzMzNDE1NSI+8J+TjSAnK3BsYWNlTmFtZSsnPC9kaXY+JwogICAgICArKHMubWVtbz8nPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6Izg4ODttYXJnaW4tdG9wOjNweCI+JytzLm1lbW8rJzwvZGl2Pic6JycpKyc8L2Rpdj4nCiAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpmbGV4LWVuZDtnYXA6NnB4Ij48c3BhbiBzdHlsZT0iZm9udC1zaXplOjEycHg7cGFkZGluZzo1cHggMTRweDtib3JkZXItcmFkaXVzOjIwcHg7Zm9udC13ZWlnaHQ6NzAwOycrKGlzQ29uZj8nYmFja2dyb3VuZDonK3BjKyc7Y29sb3I6I2ZmZic6J2JvcmRlcjoycHggc29saWQgJytwYysnO2NvbG9yOicrcGMpKyciPicrcy5zdGF0dXMrJzwvc3Bhbj4nOwogICAgaWYoaXNBZG0mJiFpc0NvbmYpaCs9JzxidXR0b24gb25jbGljaz0iY29uZmlybVNjaGVkdWxlKCcrcy5yb3crJykiIHN0eWxlPSJwYWRkaW5nOjZweCAxNHB4O2JhY2tncm91bmQ6JytwYysnO2NvbG9yOiNmZmY7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czo4cHg7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO2N1cnNvcjpwb2ludGVyO2ZvbnQtZmFtaWx5OmluaGVyaXQiPu2ZleyglTwvYnV0dG9uPic7CiAgICBoKz0nPC9kaXY+PC9kaXY+PC9kaXY+JzsKICB9CiAgZWwuaW5uZXJIVE1MPWg7Cn0KZnVuY3Rpb24gY29uZmlybVNjaGVkdWxlKHJvdyl7c2hvd0xvYWRpbmcoKTtnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7aGlkZUxvYWRpbmcoKTtpZihyLm9rKWxvYWRTY2hlZHVsZURhdGEoKX0pLndpdGhGYWlsdXJlSGFuZGxlcihmdW5jdGlvbigpe2hpZGVMb2FkaW5nKCl9KS5jb25maXJtQnJvYWRjYXN0U2NoZWR1bGUocm93KX0KCmZ1bmN0aW9uIGxvYWRQZXJmb3JtYW5jZSgpewogIHZhciBpc0FkbT1jdXJyZW50VXNlciYmKGN1cnJlbnRVc2VyLnJvbGU9PT0n66eI7Iqk7YSwJ3x8Y3VycmVudFVzZXIucm9sZT09PSfrtoDrp4jsiqTthLAnfHxjdXJyZW50VXNlci5yb2xlPT09J+q0gOumrOyekCcpOwogIGlmKGlzQWRtKXtsb2FkU2VsbGVyQW5hbHl0aWNzKCk7cmV0dXJufQogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZXJmRGF0ZUZpbHRlcicpLnN0eWxlLmRpc3BsYXk9J2ZsZXgnOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZXJmSGVhZGVyJykudGV4dENvbnRlbnQ9J/Cfk4og7YyQ66ek7ZiE7ZmpJzsKICB2YXIgZnJvbURhdGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BlcmZGcm9tJykudmFsdWV8fCcnOwogIHZhciB0b0RhdGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BlcmZUbycpLnZhbHVlfHwnJzsKICBzaG93TG9hZGluZygpOwogIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihyKXtoaWRlTG9hZGluZygpOwogICAgdmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdteVBlcmZvcm1hbmNlJyk7CiAgICBpZighcnx8IXIubGVuZ3RoKXtlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoxMnB4Ij7si6TsoIEg642w7J207YSw6rCAIOyXhuyKteuLiOuLpDwvZGl2Pic7cmV0dXJufQogICAgdmFyIGg9Jyc7ci5mb3JFYWNoKGZ1bmN0aW9uKHApewogICAgICB2YXIgcmF0ZT1wLmFtb3VudD4wP01hdGgucm91bmQocC5tYXJnaW4vcC5hbW91bnQqMTAwKTowOwogICAgICBoKz0nPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmZmO2JvcmRlcjoxcHggc29saWQgI2UyZThmMDtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxMnB4O21hcmdpbi1ib3R0b206NnB4Ij4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyIj4nCiAgICAgICAgKyc8c3BhbiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwIj4nK3AubGFiZWwrJzwvc3Bhbj4nCiAgICAgICAgKyc8c3BhbiBzdHlsZT0iZm9udC1zaXplOjEycHg7Y29sb3I6Izg4OCI+JytwLmNvdW50KyfqsbQ8L3NwYW4+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyIDFmcjtnYXA6NnB4O21hcmdpbi10b3A6OHB4Ij4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMGZkZjQ7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+66ek7LacPC9kaXY+PGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMwRjZFNTYiPuKCqScrZm10KHAuYW1vdW50KSsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmVmY2U4O2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6NnB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPuuniOynhDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojZjU5ZTBiIj7igqknK2ZtdChwLm1hcmdpbikrJzwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YxZjVmOTtib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjZweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4Ij7siJjsnbXrpaA8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXdlaWdodDo3MDA7Y29sb3I6JysocmF0ZT49MzA/JyMwRjZFNTYnOnJhdGU+PTE1PycjZjU5ZTBiJzonI2RjMjYyNicpKyciPicrcmF0ZSsnJTwvZGl2PjwvZGl2PicKICAgICAgICArJzwvZGl2PjwvZGl2Pic7CiAgICB9KTtlbC5pbm5lckhUTUw9aDsKICB9KS5nZXRQZXJmb3JtYW5jZURhdGEoY3VycmVudFVzZXIucm9sZSxjdXJyZW50VXNlci5uYW1lLGZyb21EYXRlLHRvRGF0ZSk7Cn0KCmZ1bmN0aW9uIGxvYWRTZWxsZXJBbmFseXRpY3MoKXsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGVyZkRhdGVGaWx0ZXInKS5zdHlsZS5kaXNwbGF5PSdub25lJzsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGVyZkhlYWRlcicpLnRleHRDb250ZW50PSfwn5OKIOyFgOufrCDsmrTsmIEg67aE7ISdJzsKICB2YXIgZWw9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215UGVyZm9ybWFuY2UnKTsKICBlbC5pbm5lckhUTUw9JzxkaXYgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO3BhZGRpbmc6MjBweDtjb2xvcjojODg4Ij7rtoTshJ0g7KSRLi4uPC9kaXY+JzsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7CiAgICBpZighcnx8IXIub2t8fCFyLnNlbGxlcnN8fCFyLnNlbGxlcnMubGVuZ3RoKXtlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoxMnB4Ij7rjbDsnbTthLAg7JeG7J2MPC9kaXY+JztyZXR1cm59CiAgICB2YXIgbGlzdD1yLnNlbGxlcnM7CiAgICB2YXIgdFNhbGVzPTAsdE1hcmdpbj0wLHRPcmRlcnM9MDsKICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbihzKXt0U2FsZXMrPXMudG90YWw7dE1hcmdpbis9cy5tYXJnaW47dE9yZGVycys9cy5vcmRlcnN9KTsKICAgIHZhciB0UmF0ZT10U2FsZXM+MD9NYXRoLnJvdW5kKHRNYXJnaW4vdFNhbGVzKjEwMCk6MDsKICAgIHZhciBoPSc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyIDFmcjtnYXA6OHB4O21hcmdpbi1ib3R0b206MTZweCI+JwogICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YwZmRmNDtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxMnB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojODg4Ij7soITssrQg66ek7LacPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE4cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMwRjZFNTYiPuKCqScrZm10KHRTYWxlcykrJzwvZGl2PjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZWZjZTg7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MTJweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Y29sb3I6Izg4OCI+7KCE7LK0IOuniOynhDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxOHB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojZjU5ZTBiIj7igqknK2ZtdCh0TWFyZ2luKSsnPC9kaXY+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YxZjVmOTtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxMnB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojODg4Ij7siJjsnbXrpaA8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MThweDtmb250LXdlaWdodDo3MDA7Y29sb3I6JysodFJhdGU+PTMwPycjMEY2RTU2JzonI2Y1OWUwYicpKyciPicrdFJhdGUrJyU8L2Rpdj48L2Rpdj4nCiAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjFmNWY5O2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjEycHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM4ODgiPuyFgOufrDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxOHB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMzM0MTU1Ij4nK2xpc3QubGVuZ3RoKyfrqoU8L2Rpdj48L2Rpdj4nCiAgICAgICsnPC9kaXY+JzsKICAgIGxpc3QuZm9yRWFjaChmdW5jdGlvbihzLGlkeCl7CiAgICAgIHZhciBzdEljb249eyftlbXsi6zshYDrn6wnOifirZAnLCfshLHsnqXspJEnOifwn5SlJywn7ZWY65297KSRJzon4pqg77iPJywn67mE7Zmc7ISxJzon4p2MJywn7Zmc7ISxJzon4pyFJ307CiAgICAgIHZhciBzdENvbG9yPXsn7ZW17Ius7IWA65+sJzonI2Y1OWUwYicsJ+yEseyepeykkSc6JyMwRjZFNTYnLCftlZjrnb3spJEnOicjZGMyNjI2Jywn67mE7Zmc7ISxJzonIzk0YTNiOCcsJ+2ZnOyEsSc6JyMzYjgyZjYnfTsKICAgICAgdmFyIHN0Qmc9eyftlbXsi6zshYDrn6wnOicjZmVmY2U4Jywn7ISx7J6l7KSRJzonI2YwZmRmNCcsJ+2VmOudveykkSc6JyNmZWYyZjInLCfruYTtmZzshLEnOicjZjFmNWY5Jywn7Zmc7ISxJzonI2VmZjZmZid9OwogICAgICB2YXIgaWNvbj1zdEljb25bcy5zdGF0dXNdfHwn4pyFJzsKICAgICAgdmFyIHNjPXN0Q29sb3Jbcy5zdGF0dXNdfHwnIzg4OCc7CiAgICAgIHZhciBzYj1zdEJnW3Muc3RhdHVzXXx8JyNmMWY1ZjknOwogICAgICB2YXIgbGFzdFR4dD1zLmRheXNTaW5jZTw9MD8n7Jik64qYJzpzLmRheXNTaW5jZSsn7J287KCEJzsKICAgICAgaCs9JzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czoxMnB4O21hcmdpbi1ib3R0b206OHB4O292ZXJmbG93OmhpZGRlbiI+JwogICAgICAgICsnPGRpdiBzdHlsZT0icGFkZGluZzoxNHB4O2N1cnNvcjpwb2ludGVyIiBvbmNsaWNrPSJ0b2dnbGVBbmFseXRpY3MoJytpZHgrJykiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpjZW50ZXI7bWFyZ2luLWJvdHRvbTo4cHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweCI+JwogICAgICAgICsnPGRpdiBzdHlsZT0id2lkdGg6MzZweDtoZWlnaHQ6MzZweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOicrc2IrJztkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOicrc2MrJyI+Jysocy5uYW1lfHwnPycpLmNoYXJBdCgwKSsnPC9kaXY+JwogICAgICAgICsnPGRpdj48ZGl2IHN0eWxlPSJmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjE1cHgiPicrcy5uYW1lKycgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6MnB4IDhweDtib3JkZXItcmFkaXVzOjhweDtiYWNrZ3JvdW5kOicrc2IrJztjb2xvcjonK3NjKyc7Zm9udC13ZWlnaHQ6NjAwIj4nK2ljb24rJyAnK3Muc3RhdHVzKyc8L3NwYW4+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjExcHg7Y29sb3I6Izg4ODttYXJnaW4tdG9wOjJweCI+7LWc6re87KO866y4OiAnK2xhc3RUeHQrKHMubGFzdEJjPycgwrcg67Cp7IahOiAnK3MuYmNDb3VudCsn7ZqMJzonJykrJzwvZGl2PjwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9InRleHQtYWxpZ246cmlnaHQiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMEY2RTU2Ij7igqknK2ZtdChzLnRvdGFsKSsnPC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjExcHg7Y29sb3I6Jysocy5ncm93dGhXPj0wPycjMEY2RTU2JzonI2RjMjYyNicpKyciPuyjvOqwhCAnKyhzLmdyb3d0aFc+PTA/J+KWsic6J+KWvCcpK01hdGguYWJzKHMuZ3Jvd3RoVykrJyU8L2Rpdj48L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCg1LDFmcik7Z2FwOjRweCI+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjhmYWZjO2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6NnB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OHB4O2NvbG9yOiM4ODgiPuuniOynhDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojZjU5ZTBiIj4nK3MucmF0ZSsnJTwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2Y4ZmFmYztib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjZweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjhweDtjb2xvcjojODg4Ij7qsJ3ri6jqsIA8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzMzNDE1NSI+4oKpJytmbXQocy5hdmdPcmRlcikrJzwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2Y4ZmFmYztib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjZweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjhweDtjb2xvcjojODg4Ij7so7zrrLg8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzMzNDE1NSI+JytzLm9yZGVycysnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjhmYWZjO2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6NnB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OHB4O2NvbG9yOiM4ODgiPuq1rOunpOyekDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojM2I4MmY2Ij4nK3MuYnV5ZXJDb3VudCsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjhmYWZjO2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6NnB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OHB4O2NvbG9yOiM4ODgiPuuwqeyGoTwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojOGI1Y2Y2Ij4nK3MuYmNDb3VudCsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBpZD0iYW5hbHl0aWNzXycraWR4KyciIHN0eWxlPSJkaXNwbGF5Om5vbmU7cGFkZGluZzoxNHB4O2JvcmRlci10b3A6MXB4IHNvbGlkICNlMmU4ZjA7YmFja2dyb3VuZDojZmFmYWZhIj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnI7Z2FwOjhweDttYXJnaW4tYm90dG9tOjEwcHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4Ij48ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojODg4O21hcmdpbi1ib3R0b206NHB4Ij7wn5OKIOyEseqzvCDrtoTshJ08L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweCI+7LWc6re8IDfsnbwg66ek7LacOiA8YiBzdHlsZT0iY29sb3I6IzBGNkU1NiI+4oKpJytmbXQocy53MSkrJzwvYj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDttYXJnaW4tdG9wOjJweCI+7KO86rCEIOyEseyepeuloDogPGIgc3R5bGU9ImNvbG9yOicrKHMuZ3Jvd3RoVz49MD8nIzBGNkU1Nic6JyNkYzI2MjYnKSsnIj4nKyhzLmdyb3d0aFc+PTA/JysnOicnKStzLmdyb3d0aFcrJyU8L2I+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7bWFyZ2luLXRvcDoycHgiPjMw7J28IOunpOy2nDogPGI+4oKpJytmbXQocy5tMSkrJzwvYj48L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweCI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjExcHg7Y29sb3I6Izg4ODttYXJnaW4tYm90dG9tOjRweCI+8J+ToSDsmrTsmIEg7KCV67O0PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHgiPuuwqeyGoSDtmp/siJg6IDxiIHN0eWxlPSJjb2xvcjojOGI1Y2Y2Ij4nK3MuYmNDb3VudCsn7ZqMPC9iPjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O21hcmdpbi10b3A6MnB4Ij7stZzqt7wg67Cp7IahOiA8Yj4nKyhzLmxhc3RCY3x8J+yXhuydjCcpKyc8L2I+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7bWFyZ2luLXRvcDoycHgiPu2MkOunpCDsg4Htkog6IDxiPicrcy5wcm9kdWN0Q291bnQrJ+yihTwvYj48L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyO2dhcDo2cHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzo4cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM4ODgiPuy0nSDsiJjrn4k8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDAiPicrcy5xdHkrJ+qwnDwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzo4cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMHB4O2NvbG9yOiM4ODgiPuy0nSDrp4jsp4Q8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7Y29sb3I6I2Y1OWUwYiI+4oKpJytmbXQocy5tYXJnaW4pKyc8L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6OHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojODg4Ij7stZzqt7wg7KO866y4PC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwIj4nKyhzLmxhc3RPcmRlcnx8Jy0nKSsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPC9kaXY+PC9kaXY+PC9kaXY+JzsKICAgIH0pOwogICAgZWwuaW5uZXJIVE1MPWg7CiAgfSkud2l0aEZhaWx1cmVIYW5kbGVyKGZ1bmN0aW9uKCl7CiAgICBlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoxMnB4Ij7roZzrlKkg7Jik66WYPC9kaXY+JzsKICB9KS5nZXRTZWxsZXJBbmFseXRpY3MoY3VycmVudFVzZXIucm9sZSxjdXJyZW50VXNlci5uYW1lKTsKfQoKZnVuY3Rpb24gdG9nZ2xlQW5hbHl0aWNzKGlkeCl7CiAgdmFyIGFsbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbaWRePSJhbmFseXRpY3NfIl0nKTsKICBmb3IodmFyIGk9MDtpPGFsbC5sZW5ndGg7aSsrKXsKICAgIGlmKHBhcnNlSW50KGFsbFtpXS5pZC5zcGxpdCgnXycpWzFdKSE9PWlkeClhbGxbaV0uc3R5bGUuZGlzcGxheT0nbm9uZSc7CiAgfQogIHZhciBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYW5hbHl0aWNzXycraWR4KTsKICBlbC5zdHlsZS5kaXNwbGF5PWVsLnN0eWxlLmRpc3BsYXk9PT0nYmxvY2snPydub25lJzonYmxvY2snOwp9CgpmdW5jdGlvbiBsb2FkUmVjZW50T3JkZXJzKCl7CiAgc2hvd0xvYWRpbmcoKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7aGlkZUxvYWRpbmcoKTsKICAgIHZhciBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjZW50T3JkZXJzJyk7CiAgICBpZighcnx8IXIubGVuZ3RoKXtlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoxMnB4Ij7rsJzso7wg64K07Jet7J20IOyXhuyKteuLiOuLpDwvZGl2Pic7cmV0dXJufQogICAgdmFyIGlzQWRtaW49Y3VycmVudFVzZXImJihjdXJyZW50VXNlci5yb2xlPT09J+uniOyKpO2EsCd8fGN1cnJlbnRVc2VyLnJvbGU9PT0n67aA66eI7Iqk7YSwJ3x8Y3VycmVudFVzZXIucm9sZT09PSfqtIDrpqzsnpAnKTsKICAgIHZhciBoPScnO3Iuc2xpY2UoMCwyMCkuZm9yRWFjaChmdW5jdGlvbihvLGlkeCl7CiAgICAgIHZhciBzYz17J+yeheq4iO2ZleyduOyghCc6e2JnOicjZmVmMmYyJyxjb2xvcjonI2RjMjYyNid9LCfsnoXquIjsmYTro4wnOntiZzonI2ZlZjNjNycsY29sb3I6JyM5MjQwMGUnfSwn67Cc7Iah7KSA67mEJzp7Ymc6JyNkYmVhZmUnLGNvbG9yOicjMWU0MGFmJ30sJ+uwnOyGoeyZhOujjCc6e2JnOicjZDFmYWU1Jyxjb2xvcjonIzA2NWY0Nid9LCfrtoDrtoTstpzqs6AnOntiZzonI2ZlZmNlOCcsY29sb3I6JyM4NTRkMGUnfX07CiAgICAgIHZhciBzdD1zY1tvLm1haW5TdGF0dXNdfHxzY1sn7J6F6riI7ZmV7J247KCEJ107CiAgICAgIHZhciBwcm9maXRSYXRlPW8uYW1vdW50PjA/TWF0aC5yb3VuZChvLm1hcmdpbi9vLmFtb3VudCoxMDApOjA7CiAgICAgIGgrPSc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6MTJweDtwYWRkaW5nOjE0cHg7bWFyZ2luLWJvdHRvbToxMHB4Ij4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO21hcmdpbi1ib3R0b206MTBweCI+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NnB4Ij48c3BhbiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToxNHB4Ij7wn5OFICcrby5kYXRlKyc8L3NwYW4+JwogICAgICAgICsoby5zZWxsZXI/JzxzcGFuIHN0eWxlPSJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCAxMHB4O2JvcmRlci1yYWRpdXM6MTBweDtiYWNrZ3JvdW5kOiNkYmVhZmU7Y29sb3I6IzFlNDBhZjtmb250LXdlaWdodDo3MDAiPvCfkaQgJytvLnNlbGxlcisnPC9zcGFuPic6JycpCiAgICAgICAgKyhpc0FkbWluPyc8YnV0dG9uIG9uY2xpY2s9ImRlbGV0ZU9yZGVyQmF0Y2hDb25maXJtKFwnJytvLmRhdGUrJ1wnLFwnJytvLnNlbGxlcisnXCcgKSIgc3R5bGU9ImJhY2tncm91bmQ6I2ZlZjJmMjtib3JkZXI6MXB4IHNvbGlkICNmY2E1YTU7Ym9yZGVyLXJhZGl1czo0cHg7Y29sb3I6I2RjMjYyNjtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTBweDtwYWRkaW5nOjJweCA2cHgiPuyCreygnDwvYnV0dG9uPic6JycpKyc8L2Rpdj4nCiAgICAgICAgKyc8c3BhbiBzdHlsZT0iZm9udC1zaXplOjExcHg7cGFkZGluZzo0cHggMTJweDtib3JkZXItcmFkaXVzOjIwcHg7YmFja2dyb3VuZDonK3N0LmJnKyc7Y29sb3I6JytzdC5jb2xvcisnO2ZvbnQtd2VpZ2h0OjcwMCI+JytvLm1haW5TdGF0dXMrJzwvc3Bhbj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyO2dhcDo2cHg7bWFyZ2luLWJvdHRvbTo4cHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YwZmRmNDtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4ODttYXJnaW4tYm90dG9tOjJweCI+66ek7LacPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE2cHg7Zm9udC13ZWlnaHQ6ODAwO2NvbG9yOiMwRjZFNTYiPuKCqScrZm10KG8uYW1vdW50KSsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmFmNWZmO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4O21hcmdpbi1ib3R0b206MnB4Ij7qs7XquInqsIA8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTZweDtmb250LXdlaWdodDo4MDA7Y29sb3I6IzdjM2FlZCI+4oKpJytmbXQoby5zdXBwbHlDb3N0KSsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmVmY2U4O2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4O21hcmdpbi1ib3R0b206MnB4Ij7siJjsnbUgKCcrcHJvZml0UmF0ZSsnJSk8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTZweDtmb250LXdlaWdodDo4MDA7Y29sb3I6I2Y1OWUwYiI+4oKpJytmbXQoby5tYXJnaW4pKyc8L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyO2dhcDo2cHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YxZjVmOTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjhweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4Ij7qtazrp6TsnpA8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzNiODJmNiI+JytvLmJ1eWVyQ291bnQrJ+uqhTwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YxZjVmOTtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjhweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4Ij7rsJzso7w8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7Y29sb3I6IzMzNDE1NSI+JytvLmNvdW50KyfqsbQnKyhvLnRvdGFsUXR5PycgKCcrby50b3RhbFF0eSsn6rCcKSc6JycpKyc8L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMWY1Zjk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzo4cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+7IiY7J2166WgPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOicrKHByb2ZpdFJhdGU+PTMwPycjMEY2RTU2Jzpwcm9maXRSYXRlPj0xNT8nI2Y1OWUwYic6JyNkYzI2MjYnKSsnIj4nK3Byb2ZpdFJhdGUrJyU8L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8L2Rpdj4nCiAgICAgICAgKyhpc0FkbWluPyc8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjhweDtkaXNwbGF5OmZsZXg7Z2FwOjZweCI+JwogICAgICAgICsnPGJ1dHRvbiBvbmNsaWNrPSJleHBhbmRPcmRlcnMoXCcnK28uZGF0ZSsnXCcsdGhpcykiIHN0eWxlPSJmbGV4OjE7cGFkZGluZzo2cHg7YmFja2dyb3VuZDojZjFmNWY5O2JvcmRlcjoxcHggc29saWQgI2UyZThmMDtib3JkZXItcmFkaXVzOjZweDtmb250LXNpemU6MTFweDtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0O2NvbG9yOiMzMzQxNTUiPvCfk4sg7IOB7IS467O06riwPC9idXR0b24+JwogICAgICAgICsnPHNlbGVjdCBvbmNoYW5nZT0iYnVsa1N0YXR1c0NoYW5nZShcJycrby5kYXRlKydcJyxcJ3BheVwnLHRoaXMudmFsdWUpIiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6NnB4O2JvcmRlcjoxcHggc29saWQgI2UyZThmMDtib3JkZXItcmFkaXVzOjZweDtmb250LXNpemU6MTFweDtmb250LWZhbWlseTppbmhlcml0O2JhY2tncm91bmQ6I2ZmZiI+PG9wdGlvbiB2YWx1ZT0iIj7snoXquIjsg4Htg5wg7J286rSE67OA6rK9PC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0i7J6F6riI7ZmV7J247KCEIj7snoXquIjtmZXsnbjsoIQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSLsnoXquIjsmYTro4wiPuyeheq4iOyZhOujjDwvb3B0aW9uPjwvc2VsZWN0PicKICAgICAgICArJzxzZWxlY3Qgb25jaGFuZ2U9ImJ1bGtTdGF0dXNDaGFuZ2UoXCcnK28uZGF0ZSsnXCcsXCdzaGlwXCcsdGhpcy52YWx1ZSkiIHN0eWxlPSJmbGV4OjE7cGFkZGluZzo2cHg7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6NnB4O2ZvbnQtc2l6ZToxMXB4O2ZvbnQtZmFtaWx5OmluaGVyaXQ7YmFja2dyb3VuZDojZmZmIj48b3B0aW9uIHZhbHVlPSIiPuy2nOqzoOyDge2DnCDsnbzqtITrs4Dqsr08L29wdGlvbj48b3B0aW9uIHZhbHVlPSLrjIDquLAiPuuMgOq4sDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IuuwnOyGoeykgOu5hCI+67Cc7Iah7KSA67mEPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0i7Lac6rOg7JmE66OMIj7stpzqs6DsmYTro4w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSLrtoDrtoTstpzqs6AiPuu2gOu2hOy2nOqzoDwvb3B0aW9uPjwvc2VsZWN0PicKICAgICAgICArJzwvZGl2Pic6JycpCiAgICAgICAgKyc8ZGl2IGlkPSJvcmRlckRldGFpbF8nK28uZGF0ZS5yZXBsYWNlKC8tL2csJycpKyciIHN0eWxlPSJkaXNwbGF5Om5vbmU7bWFyZ2luLXRvcDo4cHgiPjwvZGl2PicKICAgICAgICArJzwvZGl2Pic7CiAgICB9KTtlbC5pbm5lckhUTUw9aDsKICB9KS53aXRoRmFpbHVyZUhhbmRsZXIoZnVuY3Rpb24oKXtoaWRlTG9hZGluZygpfSkuZ2V0UmVjZW50T3JkZXJCYXRjaGVzKGN1cnJlbnRVc2VyLnJvbGUsY3VycmVudFVzZXIubmFtZSk7Cn0KCmZ1bmN0aW9uIHRvZ2dsZUJyb2FkY2FzdE1vZGFsKCl7CiAgaWYoaXNMaXZlKXtpZihjb25maXJtKCfrsKnshqHsnYQg7KKF66OM7ZWY7Iuc6rKg7Iq164uI6rmMPycpKWRvRW5kQnJvYWRjYXN0KCk7cmV0dXJufQogIHZhciBtPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdicm9hZGNhc3RNb2RhbCcpOwogIG0uc3R5bGUuZGlzcGxheT1tLnN0eWxlLmRpc3BsYXk9PT0nZmxleCc/J25vbmUnOidmbGV4JzsKICByZW5kZXJQbGF0Zm9ybXMoKTsKfQpmdW5jdGlvbiBjbG9zZUJyb2FkY2FzdE1vZGFsKCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Jyb2FkY2FzdE1vZGFsJykuc3R5bGUuZGlzcGxheT0nbm9uZSd9CgovLyDilZDilZDilZAg67Cc7KO8IOKVkOKVkOKVkApmdW5jdGlvbiBkb1N1Ym1pdE9yZGVyKCl7CiAgdmFyIGNvZGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyUHJvZHVjdCcpLnZhbHVlOwogIHZhciBxdHk9cGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyUXR5JykudmFsdWUpfHwwOwogIHZhciByZWNpcGllbnQ9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyUmVjaXBpZW50JykudmFsdWUudHJpbSgpOwogIHZhciBjb250YWN0PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlckNvbnRhY3QnKS52YWx1ZS50cmltKCk7CiAgdmFyIGFkZHJlc3M9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyQWRkcmVzcycpLnZhbHVlLnRyaW0oKTsKICBpZighY29kZSl7c2hvd1RvYXN0KCfsg4HtkojsnYQg7ISg7YOd7ZWY7IS47JqUJywnaW5mbycpO3JldHVybn0KICBpZihxdHk8MSl7c2hvd1RvYXN0KCfsiJjrn4nsnYQg7J6F66Cl7ZWY7IS47JqUJywnaW5mbycpO3JldHVybn0KICBpZighcmVjaXBpZW50fHwhY29udGFjdHx8IWFkZHJlc3Mpe3Nob3dUb2FzdCgn67Cw7Iah7KCV67O066W8IOyeheugpe2VmOyEuOyalCcsJ2luZm8nKTtyZXR1cm59CiAgc2hvd0xvYWRpbmcoKTsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7aGlkZUxvYWRpbmcoKTsKICAgIGlmKHIuc3VjY2Vzcyl7CiAgICAgIGxpdmVTdGF0cy5vcmRlcnMrKztsaXZlU3RhdHMucmV2ZW51ZSs9ci5hbW91bnQ7CiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0T3JkZXJzJykudGV4dENvbnRlbnQ9bGl2ZVN0YXRzLm9yZGVyczsKICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N0YXRSZXZlbnVlJykudGV4dENvbnRlbnQ9J+KCqScrZm10KGxpdmVTdGF0cy5yZXZlbnVlKTsKICAgICAgc2hvd1RvYXN0KCfrsJzso7wg7JmE66OMISDso7zrrLjrsojtmLg6ICcrci5vcmRlck5vLCdzdWNjZXNzJyk7CiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclByb2R1Y3QnKS52YWx1ZT0nJztkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3JkZXJRdHknKS52YWx1ZT0nMSc7CiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclJlY2lwaWVudCcpLnZhbHVlPScnO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlckNvbnRhY3QnKS52YWx1ZT0nJzsKICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29yZGVyQWRkcmVzcycpLnZhbHVlPScnO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlclByb2R1Y3RJbmZvJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcmRlckFtb3VudCcpLnRleHRDb250ZW50PSfigqkwJztsb2FkUHJvZHVjdHMoKTsKICAgIH1lbHNlIHNob3dUb2FzdChyLm1lc3NhZ2V8fCfsmKTrpZgnLCdlcnJvcicpOwogIH0pLnN1Ym1pdE9yZGVyKHtwcm9kdWN0Q29kZTpjb2RlLHF0eTpxdHksc2VsbGVyOmN1cnJlbnRVc2VyLm5hbWUsYnJvYWRjYXN0Q29kZTpjdXJyZW50QnJvYWRjYXN0Q29kZXx8JycsYWRtaW5JZDpjdXJyZW50VXNlci5hZG1pbklkfHwnJ30pOwp9CgovLyDilZDilZDilZAg7LWc6re8IOuwqeyGoSDilZDilZDilZAKZnVuY3Rpb24gbG9hZFJlY2VudEJyb2FkY2FzdHMoKXsKICBzaG93TG9hZGluZygpOwogIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihkYXRhKXtoaWRlTG9hZGluZygpOwogICAgdmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNlbnRMaXN0Jyk7CiAgICBpZighZGF0YXx8ZGF0YS5sZW5ndGg9PT0wKXtlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoxMnB4Ij7slYTsp4Eg67Cp7IahIOydtOugpeydtCDsl4bsirXri4jri6Q8L2Rpdj4nO3JldHVybn0KICAgIHZhciBodG1sPScnOwogICAgZm9yKHZhciBpPTA7aTxkYXRhLmxlbmd0aDtpKyspe3ZhciBiPWRhdGFbaV07CiAgICAgIGh0bWwrPSc8ZGl2IGNsYXNzPSJoaXN0b3J5LXJvdyI+PGRpdj48ZGl2IHN0eWxlPSJmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOjEzcHgiPicrYi5jb2RlKycgPHNwYW4gY2xhc3M9InRhZyIgc3R5bGU9ImJhY2tncm91bmQ6I2YwZjBmMDtjb2xvcjojNjY2Ij4nK2IucGxhdGZvcm0rJzwvc3Bhbj48L2Rpdj48ZGl2IGNsYXNzPSJtdXRlZCI+JysoYi5zdGFydFRpbWV8fCcnKSsnPC9kaXY+PC9kaXY+PGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NjAwIj7igqknK2ZtdChiLnJldmVudWUpKyc8L2Rpdj48L2Rpdj4nOwogICAgfWVsLmlubmVySFRNTD1odG1sOwogIH0pLmdldFJlY2VudEJyb2FkY2FzdHMoY3VycmVudFVzZXIubmFtZSk7Cn0KCi8vIOKVkOKVkOKVkCDrgrQg7Iuk7KCBIOKVkOKVkOKVkApmdW5jdGlvbiBsb2FkTXlTdGF0cygpewogIHNob3dMb2FkaW5nKCk7CiAgZ29vZ2xlLnNjcmlwdC5ydW4ud2l0aFN1Y2Nlc3NIYW5kbGVyKGZ1bmN0aW9uKGRhdGEpe2hpZGVMb2FkaW5nKCk7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbXlPcmRlcnMnKS50ZXh0Q29udGVudD0oZGF0YS5vcmRlcnN8fDApKyfqsbQnOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215UmV2ZW51ZScpLnRleHRDb250ZW50PSfigqknK2ZtdChkYXRhLnJldmVudWUpOwogICAgdmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdteVRvcFByb2R1Y3RzJyk7CiAgICBpZighZGF0YS50b3BQcm9kdWN0c3x8ZGF0YS50b3BQcm9kdWN0cy5sZW5ndGg9PT0wKXtlbC5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoxNnB4Ij7rsJzso7wg642w7J207YSw6rCAIOyMk+ydtOuptCDtkZzsi5zrkKnri4jri6Q8L2Rpdj4nO3JldHVybn0KICAgIHZhciBodG1sPScnOwogICAgZm9yKHZhciBpPTA7aTxkYXRhLnRvcFByb2R1Y3RzLmxlbmd0aDtpKyspe3ZhciBwPWRhdGEudG9wUHJvZHVjdHNbaV07CiAgICAgIGh0bWwrPSc8ZGl2IGNsYXNzPSJwcm9kdWN0LXJvdyI+PGRpdj48c3BhbiBzdHlsZT0iZm9udC13ZWlnaHQ6NjAwIj4nKyhpKzEpKyc8L3NwYW4+ICcrKChwLm5hbWV8fCcnKS5zdWJzdHJpbmcoMCwyMCkpKyc8L2Rpdj48ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOnJpZ2h0Ij48ZGl2IHN0eWxlPSJmb250LXdlaWdodDo2MDAiPicrcC5xdHkrJ+qwnDwvZGl2PjxkaXYgY2xhc3M9Im11dGVkIj7igqknK2ZtdChwLnJldmVudWUpKyc8L2Rpdj48L2Rpdj48L2Rpdj4nOwogICAgfWVsLmlubmVySFRNTD1odG1sOwogIH0pLmdldFNlbGxlclN0YXRzKGN1cnJlbnRVc2VyLm5hbWUpOwp9CgovLyDilZDilZDilZAg64K0IOyFgOufrCAo6rSA66as7J6QKSDilZDilZDilZAKZnVuY3Rpb24gbG9hZE15U2VsbGVyc1RhYigpewogIHZhciBlbD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbXlTZWxsZXJMaXN0Jyk7CiAgdmFyIGVsMj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VsbGVyT3JkZXJzJyk7CiAgZWwuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjIwcHg7Y29sb3I6Izg4OCI+67aI65+s7Jik64qUIOykkS4uLjwvZGl2Pic7CiAgZWwyLmlubmVySFRNTD0nJzsKICB2YXIgc2VhcmNoTmFtZT1jdXJyZW50VXNlci5uYW1lfHxjdXJyZW50VXNlci5pZDsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24oc2VsbGVycyl7CiAgICB2YXIgZWwyPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGxTZWxsZXJMaXN0Jyk7CiAgICBpZighc2VsbGVyc3x8IXNlbGxlcnMubGVuZ3RoKXtlbDIuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJtdXRlZCIgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO3BhZGRpbmc6MTZweCI+65Ox66Gd65CcIOyFgOufrOqwgCDsl4bsirXri4jri6Q8L2Rpdj4nO3JldHVybn0KICAgIHZhciBoPSc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtjb2xvcjojODg4O21hcmdpbi1ib3R0b206OHB4Ij7soITssrQg7IWA65+sICcrc2VsbGVycy5sZW5ndGgrJ+uqhTwvZGl2Pic7CiAgICBzZWxsZXJzLmZvckVhY2goZnVuY3Rpb24ocyl7CiAgICAgIGgrPSc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjEycHg7bWFyZ2luLWJvdHRvbTo2cHg7Y3Vyc29yOnBvaW50ZXIiIG9uY2xpY2s9InRvZ2dsZVNlbGxlckRldGFpbCh0aGlzLFwnJytzLm5hbWUrJ1wnKSI+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlciI+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTBweCI+JwogICAgICAgICsnPGRpdiBzdHlsZT0id2lkdGg6MzRweDtoZWlnaHQ6MzRweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOiNkYmVhZmU7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMWU0MGFmIj4nKyhzLm5hbWV8fCc/JykuY2hhckF0KDApKyc8L2Rpdj4nCiAgICAgICAgKyc8ZGl2PjxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTNweCI+JytzLm5hbWUrJyA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Y29sb3I6Izg4ODtmb250LXdlaWdodDo0MDAiPuKWuCDsg4HshLg8L3NwYW4+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0iZm9udC1zaXplOjExcHg7Y29sb3I6Izg4OCI+7IaM7IaNOiAnKyhzLm9yZ3x8J+uvuOyngOyglScpKycgwrcgJysocy5jaGFubmVsc3x8Jy0nKSsnPC9kaXY+PC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjExcHg7Y29sb3I6Izg4OCI+Jysocy5waG9uZXx8JycpKyc8L2Rpdj4nCiAgICAgICAgKyc8c3BhbiBzdHlsZT0iZm9udC1zaXplOjEwcHg7cGFkZGluZzoycHggOHB4O2JvcmRlci1yYWRpdXM6OHB4O2JhY2tncm91bmQ6Jysocy5zdGF0dXM9PT0n7IWA65+sJ3x8cy5zdGF0dXM9PT0n7Iq57J24Jz8nI2QxZmFlNTtjb2xvcjojMDY1ZjQ2JzonI2ZlZjNjNztjb2xvcjojOTI0MDBlJykrJyI+Jysocy5zdGF0dXN8fCfshYDrn6wnKSsnPC9zcGFuPjwvZGl2PicKICAgICAgICArJzwvZGl2PicKICAgICAgICArJzxkaXYgY2xhc3M9InNlbGxlci1kZXRhaWwtcGFuZWwiIHN0eWxlPSJkaXNwbGF5Om5vbmU7bWFyZ2luLXRvcDoxMHB4O3BhZGRpbmctdG9wOjEwcHg7Ym9yZGVyLXRvcDoxcHggZGFzaGVkICNlMmU4ZjAiPjxkaXYgc3R5bGU9ImNvbG9yOiM4ODg7Zm9udC1zaXplOjExcHgiPuuhnOuUqeykkS4uLjwvZGl2PjwvZGl2PjwvZGl2Pic7CiAgICB9KTsKICAgIGVsMi5pbm5lckhUTUw9aDsKICB9KS5nZXRBbGxTZWxsZXJzKCk7Cn0KCnZhciBQTEFDRV9DT0xPUlNfQURNSU49eyfsiojtjbzrrLTsp4Qg64yA6rWs7KCQJzonI2RjMjYyNicsJ+yKiO2NvOustOynhCDrqoXrj5nsoJAnOicjM2I4MmY2Jywn7IqI7Y2866y07KeEIOqwleuPmeygkCc6JyM4YjVjZjYnfTsKCmZ1bmN0aW9uIGxvYWRBbGxBZG1pbnNUYWIoKXsKICBzaG93TG9hZGluZygpOwogIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihsaXN0KXtoaWRlTG9hZGluZygpOwogICAgdmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhZG1pbkRhc2hib2FyZCcpOwogICAgaWYoIWxpc3R8fCFsaXN0Lmxlbmd0aCl7ZWwuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJtdXRlZCIgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO3BhZGRpbmc6MTJweCI+6rSA66as7J6QIOyXhuydjDwvZGl2Pic7cmV0dXJufQogICAgdmFyIGg9Jyc7CiAgICBsaXN0LmZvckVhY2goZnVuY3Rpb24oYSxpZHgpewogICAgICB2YXIgcmF0ZT1hLnRvdGFsU2FsZXM+MD9NYXRoLnJvdW5kKGEudG90YWxNYXJnaW4vYS50b3RhbFNhbGVzKjEwMCk6MDsKICAgICAgaCs9JzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czoxMnB4O21hcmdpbi1ib3R0b206MTBweDtvdmVyZmxvdzpoaWRkZW4iPicKICAgICAgICArJzxkaXYgc3R5bGU9InBhZGRpbmc6MTRweDtjdXJzb3I6cG9pbnRlciIgb25jbGljaz0idG9nZ2xlQWRtaW5EZXRhaWwodGhpcyxcJycrYS5uYW1lKydcJykiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpjZW50ZXI7bWFyZ2luLWJvdHRvbToxMHB4Ij4nCiAgICAgICAgKyc8ZGl2PjxzcGFuIHN0eWxlPSJmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjE1cHgiPicrYS5uYW1lKyc8L3NwYW4+IDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA4cHg7Ym9yZGVyLXJhZGl1czoxMHB4O2JhY2tncm91bmQ6I0VFRURGRTtjb2xvcjojNTM0QUI3O2ZvbnQtd2VpZ2h0OjYwMCI+JythLnJvbGUrJzwvc3Bhbj4nCiAgICAgICAgKycgPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM4ODgiPuKWuCDsg4HshLjrs7TquLA8L3NwYW4+PC9kaXY+JwogICAgICAgICsnPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiM4ODgiPuyFgOufrCAnK2Euc2VsbGVycy5sZW5ndGgrJ+uqhTwvc3Bhbj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyO2dhcDo2cHgiPicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YwZmRmNDtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+66ek7LacPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE2cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMwRjZFNTYiPuKCqScrZm10KGEudG90YWxTYWxlcykrJzwvZGl2PjwvZGl2PicKICAgICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZlZmNlODtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+66eI7KeEPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjE2cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNmNTllMGIiPuKCqScrZm10KGEudG90YWxNYXJnaW4pKyc8L2Rpdj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMWY1Zjk7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPuyImOydteuloDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxNnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjonKyhyYXRlPj0zMD8nIzBGNkU1Nic6cmF0ZT49MTU/JyNmNTllMGInOicjZGMyNjI2JykrJyI+JytyYXRlKyclPC9kaXY+PC9kaXY+JwogICAgICAgICsnPC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBpZD0iYWRtaW5EZXRhaWxfJytpZHgrJyIgc3R5bGU9ImRpc3BsYXk6bm9uZTtib3JkZXItdG9wOjFweCBzb2xpZCAjZTJlOGYwO3BhZGRpbmc6MTRweDtiYWNrZ3JvdW5kOiNmYWZhZmEiPjwvZGl2PicKICAgICAgICArJzwvZGl2Pic7CiAgICB9KTsKICAgIGVsLmlubmVySFRNTD1oOwogIH0pLndpdGhGYWlsdXJlSGFuZGxlcihmdW5jdGlvbigpe2hpZGVMb2FkaW5nKCl9KS5nZXRBZG1pbkRhc2hib2FyZCgpOwogIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihzZWxsZXJzKXsKICAgIHZhciBlbDE9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsbEFkbWluTGlzdCcpOwogICAgdmFyIGVsMj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxsU2VsbGVyTGlzdCcpOwogICAgaWYoIXNlbGxlcnN8fCFzZWxsZXJzLmxlbmd0aCl7CiAgICAgIGVsMS5pbm5lckhUTUw9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoxMnB4Ij7sl4bsnYw8L2Rpdj4nOwogICAgICBlbDIuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJtdXRlZCIgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO3BhZGRpbmc6MTJweCI+7IWA65+sIOyXhuydjDwvZGl2Pic7CiAgICAgIHJldHVybjsKICAgIH0KICAgIHZhciBhZG1pbnM9W10sc2VsbGVyTGlzdD1bXTsKICAgIHNlbGxlcnMuZm9yRWFjaChmdW5jdGlvbihzKXsKICAgICAgdmFyIHI9U3RyaW5nKHMucm9sZXx8cy5zdGF0dXN8fCcnKS50cmltKCk7CiAgICAgIGlmKHI9PT0n6rSA66as7J6QJ3x8cj09PSfrp4jsiqTthLAnfHxyPT09J+u2gOuniOyKpO2EsCcpYWRtaW5zLnB1c2gocyk7CiAgICAgIGVsc2Ugc2VsbGVyTGlzdC5wdXNoKHMpOwogICAgfSk7CiAgICB2YXIgaDE9Jyc7YWRtaW5zLmZvckVhY2goZnVuY3Rpb24oYSl7CiAgICAgIGgxKz0nPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZmZmO2JvcmRlcjoxcHggc29saWQgI2UyZThmMDtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHg7bWFyZ2luLWJvdHRvbTo0cHg7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlciI+JwogICAgICAgICsnPGRpdj48c3BhbiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwIj4nK2EubmFtZSsnPC9zcGFuPiA8c3BhbiBzdHlsZT0iZm9udC1zaXplOjEwcHg7cGFkZGluZzoycHggOHB4O2JvcmRlci1yYWRpdXM6OHB4O2JhY2tncm91bmQ6I0VFRURGRTtjb2xvcjojNTM0QUI3Ij4nKyhhLnJvbGV8fCfqtIDrpqzsnpAnKSsnPC9zcGFuPjwvZGl2PicKICAgICAgICArJzxzcGFuIHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojODg4Ij4nK2EuaWQrJzwvc3Bhbj48L2Rpdj4nOwogICAgfSk7CiAgICBlbDEuaW5uZXJIVE1MPWgxfHwnPGRpdiBjbGFzcz0ibXV0ZWQiPuyXhuydjDwvZGl2Pic7CiAgICB2YXIgaDI9JzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2NvbG9yOiM4ODg7bWFyZ2luLWJvdHRvbTo4cHgiPuy0nSAnK3NlbGxlckxpc3QubGVuZ3RoKyfrqoU8L2Rpdj4nOwogICAgc2VsbGVyTGlzdC5mb3JFYWNoKGZ1bmN0aW9uKHMpewogICAgICBoMis9JzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MTJweDttYXJnaW4tYm90dG9tOjZweDtjdXJzb3I6cG9pbnRlciIgb25jbGljaz0idG9nZ2xlU2VsbGVyRGV0YWlsKHRoaXMsXCcnK3MubmFtZSsnXCcpIj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyIj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMHB4Ij4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJ3aWR0aDozNHB4O2hlaWdodDozNHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6I2RiZWFmZTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMxZTQwYWYiPicrKHMubmFtZXx8Jz8nKS5jaGFyQXQoMCkrJzwvZGl2PicKICAgICAgICArJzxkaXY+PGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToxM3B4Ij4nK3MubmFtZSsnIDxzcGFuIHN0eWxlPSJmb250LXNpemU6MTBweDtjb2xvcjojODg4O2ZvbnQtd2VpZ2h0OjQwMCI+4pa4IOyDgeyEuDwvc3Bhbj48L2Rpdj4nCiAgICAgICAgKyc8ZGl2IHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojODg4Ij7shozsho06ICcrKHMub3JnfHxzLmFkbWluSWR8fCfrr7jsp4DsoJUnKSsnPC9kaXY+PC9kaXY+PC9kaXY+JwogICAgICAgICsnPGRpdiBzdHlsZT0idGV4dC1hbGlnbjpyaWdodCI+PHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM4ODgiPicrKHMucGhvbmV8fCcnKSsnPC9zcGFuPjwvZGl2PicKICAgICAgICArJzwvZGl2PicKICAgICAgICArJzxkaXYgY2xhc3M9InNkLXBhbmVsIiBzdHlsZT0iZGlzcGxheTpub25lO21hcmdpbi10b3A6MTBweDtwYWRkaW5nLXRvcDoxMHB4O2JvcmRlci10b3A6MXB4IGRhc2hlZCAjZTJlOGYwIj48ZGl2IHN0eWxlPSJjb2xvcjojODg4O2ZvbnQtc2l6ZToxMXB4Ij7roZzrlKnspJEuLi48L2Rpdj48L2Rpdj48L2Rpdj4nOwogICAgfSk7CiAgICBlbDIuaW5uZXJIVE1MPWgyOwogIH0pLndpdGhGYWlsdXJlSGFuZGxlcihmdW5jdGlvbigpe30pLmdldEFsbFNlbGxlcnMoKTsKfQoKZnVuY3Rpb24gdG9nZ2xlU2VsbGVyRGV0YWlsKGVsLHNlbGxlck5hbWUpewogIHZhciBwYW5lbD1lbC5xdWVyeVNlbGVjdG9yKCcuc2QtcGFuZWwnKTsKICBpZighcGFuZWwpcmV0dXJuOwogIGlmKHBhbmVsLnN0eWxlLmRpc3BsYXk9PT0nYmxvY2snKXtwYW5lbC5zdHlsZS5kaXNwbGF5PSdub25lJztyZXR1cm59CiAgaWYocGFuZWwuZ2V0QXR0cmlidXRlKCdkYXRhLWxvYWRlZCcpKXtwYW5lbC5zdHlsZS5kaXNwbGF5PSdibG9jayc7cmV0dXJufQogIHBhbmVsLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJzsKICBnb29nbGUuc2NyaXB0LnJ1bi53aXRoU3VjY2Vzc0hhbmRsZXIoZnVuY3Rpb24ocil7CiAgICBpZighcnx8IXIub2spe3BhbmVsLmlubmVySFRNTD0nPGRpdiBjbGFzcz0ibXV0ZWQiPuygleuztCDsl4bsnYw8L2Rpdj4nO3JldHVybn0KICAgIHZhciBwPXIucHJvZmlsZSxzPXIuc3RhdHM7CiAgICB2YXIgcmF0ZT1zLnRvdGFsU2FsZXM+MD9NYXRoLnJvdW5kKHMudG90YWxNYXJnaW4vcy50b3RhbFNhbGVzKjEwMCk6MDsKICAgIHBhbmVsLmlubmVySFRNTD0nPGRpdiBzdHlsZT0iZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDo2cHg7Zm9udC1zaXplOjEycHg7bWFyZ2luLWJvdHRvbToxMHB4Ij4nCiAgICAgICsnPGRpdj48c3BhbiBzdHlsZT0iY29sb3I6Izg4OCI+7Jew65297LKYOjwvc3Bhbj4gJysocC5waG9uZXx8Jy0nKSsnPC9kaXY+JwogICAgICArJzxkaXY+PHNwYW4gc3R5bGU9ImNvbG9yOiM4ODgiPuydtOuplOydvDo8L3NwYW4+ICcrKHAuZW1haWx8fCctJykrJzwvZGl2PicKICAgICAgKyc8ZGl2PjxzcGFuIHN0eWxlPSJjb2xvcjojODg4Ij7ssYTrhJA6PC9zcGFuPiAnKyhwLmNoYW5uZWxzfHwnLScpKyc8L2Rpdj4nCiAgICAgICsnPGRpdj48c3BhbiBzdHlsZT0iY29sb3I6Izg4OCI+66ek7Lac6rec66qoOjwvc3Bhbj4gJysocC5hdmdTYWxlc3x8Jy0nKSsnPC9kaXY+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImRpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmciAxZnIgMWZyO2dhcDo0cHgiPicKICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMGZkZjQ7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+66ek7LacPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMwRjZFNTYiPuKCqScrZm10KHMudG90YWxTYWxlcykrJzwvZGl2PjwvZGl2PicKICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZWZjZTg7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXIiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+66eI7KeEPC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNmNTllMGIiPuKCqScrZm10KHMudG90YWxNYXJnaW4pKyc8L2Rpdj48L2Rpdj4nCiAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjFmNWY5O2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6NnB4O3RleHQtYWxpZ246Y2VudGVyIj48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPuyImOydteuloDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjonKyhyYXRlPj0zMD8nIzBGNkU1Nic6cmF0ZT49MTU/JyNmNTllMGInOicjZGMyNjI2JykrJyI+JytyYXRlKyclPC9kaXY+PC9kaXY+JwogICAgICArJzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2YxZjVmOTtib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjZweDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iZm9udC1zaXplOjlweDtjb2xvcjojODg4Ij7rsJzso7w8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDAiPicrcy50b3RhbE9yZGVycysn6rG0PC9kaXY+PC9kaXY+PC9kaXY+JzsKICAgIHBhbmVsLnNldEF0dHJpYnV0ZSgnZGF0YS1sb2FkZWQnLCcxJyk7CiAgfSkuZ2V0U2VsbGVyUHJvZmlsZUFuZFN0YXRzKHNlbGxlck5hbWUpOwp9CgpmdW5jdGlvbiB0b2dnbGVBZG1pbkRldGFpbChlbCxhZG1pbk5hbWUpewogIHZhciBkZXRhaWw9ZWwubmV4dEVsZW1lbnRTaWJsaW5nOwogIGlmKGRldGFpbC5zdHlsZS5kaXNwbGF5PT09J2Jsb2NrJyl7ZGV0YWlsLnN0eWxlLmRpc3BsYXk9J25vbmUnO3JldHVybn0KICBpZihkZXRhaWwuaW5uZXJIVE1MKXtkZXRhaWwuc3R5bGUuZGlzcGxheT0nYmxvY2snO3JldHVybn0KICBkZXRhaWwuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPSJ0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjojODg4O3BhZGRpbmc6MTBweCI+66Gc65Sp7KSRLi4uPC9kaXY+JzsKICBkZXRhaWwuc3R5bGUuZGlzcGxheT0nYmxvY2snOwogIGdvb2dsZS5zY3JpcHQucnVuLndpdGhTdWNjZXNzSGFuZGxlcihmdW5jdGlvbihyKXsKICAgIGlmKCFyLm9rKXtkZXRhaWwuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJtdXRlZCI+642w7J207YSwIOyXhuydjDwvZGl2Pic7cmV0dXJufQogICAgdmFyIGg9Jyc7CiAgICBpZihyLnNlbGxlcnMubGVuZ3RoKXsKICAgICAgaCs9JzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjcwMDttYXJnaW4tYm90dG9tOjhweCI+8J+RpSDshozsho0g7IWA65+sICgnK3Iuc2VsbGVycy5sZW5ndGgrJ+uqhSk8L2Rpdj4nOwogICAgICByLnNlbGxlcnMuZm9yRWFjaChmdW5jdGlvbihzKXsKICAgICAgICB2YXIgc1JhdGU9cy5zYWxlcz4wP01hdGgucm91bmQocy5tYXJnaW4vcy5zYWxlcyoxMDApOjA7CiAgICAgICAgaCs9JzxkaXYgc3R5bGU9ImJhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MTJweDttYXJnaW4tYm90dG9tOjZweCI+JwogICAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO21hcmdpbi1ib3R0b206OHB4Ij4nCiAgICAgICAgICArJzxkaXY+PHNwYW4gc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTRweCI+JytzLm5hbWUrJzwvc3Bhbj4nCiAgICAgICAgICArJzxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOiM4ODg7bWFyZ2luLXRvcDoycHgiPicrKHMucGhvbmV8fCcnKSsocy5lbWFpbD8nIMK3ICcrcy5lbWFpbDonJykrKHMuY2hhbm5lbHM/JyDCtyAnK3MuY2hhbm5lbHM6JycpKyc8L2Rpdj48L2Rpdj4nCiAgICAgICAgICArJzxzcGFuIHN0eWxlPSJmb250LXNpemU6MTFweDtjb2xvcjojODg4Ij4nK3Mub3JkZXJzKyfqsbQ8L3NwYW4+PC9kaXY+JwogICAgICAgICAgKyc8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnIgMWZyO2dhcDo0cHgiPicKICAgICAgICAgICsnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDojZjBmZGY0O2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6NnB4O3RleHQtYWxpZ246Y2VudGVyO2ZvbnQtc2l6ZToxMXB4Ij48ZGl2IHN0eWxlPSJmb250LXNpemU6OXB4O2NvbG9yOiM4ODgiPuunpOy2nDwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMEY2RTU2Ij7igqknK2ZtdChzLnNhbGVzKSsnPC9kaXY+PC9kaXY+JwogICAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmZWZjZTg7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjExcHgiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+66eI7KeEPC9kaXY+PGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2NvbG9yOiNmNTllMGIiPuKCqScrZm10KHMubWFyZ2luKSsnPC9kaXY+PC9kaXY+JwogICAgICAgICAgKyc8ZGl2IHN0eWxlPSJiYWNrZ3JvdW5kOiNmMWY1Zjk7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo2cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjExcHgiPjxkaXYgc3R5bGU9ImZvbnQtc2l6ZTo5cHg7Y29sb3I6Izg4OCI+7IiY7J2166WgPC9kaXY+PGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2NvbG9yOicrKHNSYXRlPj0zMD8nIzBGNkU1Nic6c1JhdGU+PTE1PycjZjU5ZTBiJzonI2RjMjYyNicpKyciPicrc1JhdGUrJyU8L2Rpdj48L2Rpdj4nCiAgICAgICAgICArJzwvZGl2PjwvZGl2Pic7CiAgICAgIH0pOwogICAgfWVsc2V7aCs9JzxkaXYgY2xhc3M9Im11dGVkIiBzdHlsZT0ibWFyZ2luLWJvdHRvbToxMHB4Ij7shozsho0g7IWA65+sIOyXhuydjDwvZGl2Pid9CiAgICBpZihyLnNjaGVkdWxlcy5sZW5ndGgpewogICAgICBoKz0nPGRpdiBzdHlsZT0iZm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NzAwO21hcmdpbjoxMnB4IDAgOHB4Ij7wn5OFIOuLpOqwgOyYpOuKlCDrsKnshqEgKCcrci5zY2hlZHVsZXMubGVuZ3RoKyfqsbQpPC9kaXY+JzsKICAgICAgci5zY2hlZHVsZXMuZm9yRWFjaChmdW5jdGlvbihzYyl7CiAgICAgICAgdmFyIHBjPVBMQUNFX0NPTE9SU19BRE1JTltzYy5wbGFjZV18fCcjODg4JzsKICAgICAgICB2YXIgcGJnPXNjLnBsYWNlLmluZGV4T2YoJ+uMgOq1rCcpPj0wPycjZmVmMmYyJzpzYy5wbGFjZS5pbmRleE9mKCfrqoXrj5knKT49MD8nI2VmZjZmZic6JyNmNWYzZmYnOwogICAgICAgIHZhciBwbj1TdHJpbmcoc2MucGxhY2V8fCcnKS5yZXBsYWNlKCfsiojtjbzrrLTsp4QgJywnJyk7CiAgICAgICAgdmFyIGlzQ29uZj1zYy5zdGF0dXM9PT0n7ZmV7KCVJzsKICAgICAgICBoKz0nPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTBweDtwYWRkaW5nOjhweCAxMHB4O2JhY2tncm91bmQ6JytwYmcrJztib3JkZXItbGVmdDozcHggc29saWQgJytwYysnO2JvcmRlci1yYWRpdXM6MCA4cHggOHB4IDA7bWFyZ2luLWJvdHRvbTo0cHgiPicKICAgICAgICAgICsnPGRpdiBzdHlsZT0ibWluLXdpZHRoOjYwcHg7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOicrcGMrJyI+JytzYy5kYXRlLnN1YnN0cmluZyg1KSsnPC9kaXY+JwogICAgICAgICAgKyc8ZGl2IHN0eWxlPSJmbGV4OjE7Zm9udC1zaXplOjEycHg7Y29sb3I6IzMzNDE1NSI+JytzYy5zZWxsZXIrJyDCtyAnK3NjLnRpbWUrJzwvZGl2PicKICAgICAgICAgICsnPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDo0cHg7YWxpZ24taXRlbXM6Y2VudGVyIj48c3BhbiBzdHlsZT0iZm9udC1zaXplOjEwcHg7Y29sb3I6Izg4OCI+JytwbisnPC9zcGFuPicKICAgICAgICAgICsnPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMHB4O3BhZGRpbmc6MnB4IDhweDtib3JkZXItcmFkaXVzOjEwcHg7Zm9udC13ZWlnaHQ6NjAwOycrKGlzQ29uZj8nYmFja2dyb3VuZDonK3BjKyc7Y29sb3I6I2ZmZic6J2JvcmRlcjoxcHggc29saWQgJytwYysnO2NvbG9yOicrcGMpKyciPicrc2Muc3RhdHVzKyc8L3NwYW4+PC9kaXY+JwogICAgICAgICAgKyc8L2Rpdj4nOwogICAgICB9KTsKICAgIH0KICAgIGRldGFpbC5pbm5lckhUTUw9aDsKICB9KS5nZXRBZG1pbkRldGFpbChhZG1pbk5hbWUpOwp9CgovLyDilZDilZDilZAg7KCc7JWI7IScICjrp4jsiqTthLApIOKVkOKVkOKVkAovLyDilZDilZDilZAg64yA7Iuc67O065OcIOKVkOKVkOKVkApmdW5jdGlvbiB2YWxpZGF0ZVNlc3Npb24oKXsKICBpZighY3VycmVudFVzZXJ8fCFjdXJyZW50VXNlci5pZCl7ZG9Mb2dvdXQoKTtyZXR1cm4gZmFsc2V9CiAgcmV0dXJuIHRydWU7Cn0KZnVuY3Rpb24gc2hvd1RvYXN0KG1zZyx0eXBlKXsKICB2YXIgd3JhcD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9hc3RXcmFwJyk7CiAgdmFyIGljb25zPXtzdWNjZXNzOifinJMnLGVycm9yOifinJUnLGluZm86J+KEuSd9OwogIHZhciB0PWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpOwogIHQuY2xhc3NOYW1lPSd0b2FzdCB0b2FzdC0nKyh0eXBlfHwnc3VjY2VzcycpOwogIHQuaW5uZXJIVE1MPSc8ZGl2IGNsYXNzPSJ0b2FzdC1pY29uIj4nKyhpY29uc1t0eXBlfHwnc3VjY2VzcyddfHwn4pyTJykrJzwvZGl2PjxkaXYgY2xhc3M9InRvYXN0LW1zZyI+Jyttc2crJzwvZGl2Pic7CiAgd3JhcC5hcHBlbmRDaGlsZCh0KTsKICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7dC5jbGFzc0xpc3QuYWRkKCdvdXQnKTtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7aWYodC5wYXJlbnROb2RlKXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0KX0sMzAwKX0sMjUwMCk7Cn0KCmZ1bmN0aW9uIHNob3dMb2FkaW5nKG1zZyl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmdUZXh0JykudGV4dENvbnRlbnQ9bXNnfHwn7LKY66asIOykkS4uLic7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmdPdmVybGF5JykuY2xhc3NMaXN0LmFkZCgnc2hvdycpfQpmdW5jdGlvbiBoaWRlTG9hZGluZygpe2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2FkaW5nT3ZlcmxheScpLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKX0KCjwvc2NyaXB0Pgo8ZGl2IGNsYXNzPSJsb2FkaW5nLW92ZXJsYXkiIGlkPSJsb2FkaW5nT3ZlcmxheSI+PGRpdiBjbGFzcz0ibG9hZGluZy1zcGlubmVyIj48L2Rpdj48ZGl2IHN0eWxlPSJjb2xvcjojZmZmO2ZvbnQtc2l6ZToxNHB4O21hcmdpbi10b3A6MTJweDtmb250LXdlaWdodDo2MDAiIGlkPSJsb2FkaW5nVGV4dCI+7LKY66asIOykkS4uLjwvZGl2PjwvZGl2Pgo8ZGl2IGNsYXNzPSJtb2RhbC1vdmVybGF5IiBpZD0iY29uZmlybU1vZGFsIj4KICA8ZGl2IGNsYXNzPSJtb2RhbC1ib3giPgogICAgPGgzIGlkPSJjb25maXJtVGl0bGUiPu2ZleyduDwvaDM+CiAgICA8cCBpZD0iY29uZmlybU1zZyI+7KeE7ZaJ7ZWY7Iuc6rKg7Iq164uI6rmMPzwvcD4KICAgIDxkaXYgY2xhc3M9Im1vZGFsLWJ0bnMiPgogICAgICA8YnV0dG9uIG9uY2xpY2s9ImNvbmZpcm1BY3Rpb24odHJ1ZSkiIHN0eWxlPSJiYWNrZ3JvdW5kOiMwRjZFNTY7Y29sb3I6I2ZmZiIgaWQ9ImNvbmZpcm1PayI+7ZmV7J24PC9idXR0b24+CiAgICAgIDxidXR0b24gb25jbGljaz0iY29uZmlybUFjdGlvbihmYWxzZSkiIHN0eWxlPSJiYWNrZ3JvdW5kOiNlMmU4ZjA7Y29sb3I6IzY0NzQ4YiI+7Leo7IaMPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2Rpdj4KPC9kaXY+CjxkaXYgY2xhc3M9Im1vZGFsLW92ZXJsYXkiIGlkPSJkYXRlQ2hhbmdlTW9kYWwiPgogIDxkaXYgY2xhc3M9Im1vZGFsLWJveCIgc3R5bGU9InRleHQtYWxpZ246bGVmdCI+CiAgICA8aDMgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyIj7wn5OFIOydvOyglSDrs4Dqsr08L2gzPgogICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi1ib3R0b206NHB4O2NvbG9yOiM4ODgiPuuCoOynnDwvZGl2PgogICAgPGlucHV0IHR5cGU9ImRhdGUiIGlkPSJkYXRlQ2hhbmdlSW5wdXQiIHN0eWxlPSJ3aWR0aDoxMDAlO3BhZGRpbmc6MTJweDtib3JkZXI6MnB4IHNvbGlkICNlMmU4ZjA7Ym9yZGVyLXJhZGl1czoxMHB4O2ZvbnQtc2l6ZToxNXB4O2ZvbnQtZmFtaWx5OmluaGVyaXQ7bWFyZ2luLWJvdHRvbToxMnB4O2JveC1zaXppbmc6Ym9yZGVyLWJveCI+CiAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7bWFyZ2luLWJvdHRvbTo0cHg7Y29sb3I6Izg4OCI+7Iuc7J6RPC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7Ym9yZGVyOjJweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6MTBweDtvdmVyZmxvdzpoaWRkZW47YmFja2dyb3VuZDojZjhmYWZjO21hcmdpbi1ib3R0b206OHB4Ij4KICAgICAgPHNlbGVjdCBpZD0iZGNBUDEiIHN0eWxlPSJwYWRkaW5nOjEwcHggNHB4O2JvcmRlcjpub25lO2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjcwMDtmb250LWZhbWlseTppbmhlcml0O3RleHQtYWxpZ246Y2VudGVyO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Y29sb3I6IzMzNDE1NTtvdXRsaW5lOm5vbmU7Y3Vyc29yOnBvaW50ZXI7ZmxleDoxIj48b3B0aW9uIHZhbHVlPSLsmKTsoIQiPuyYpOyghDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IuyYpO2bhCIgc2VsZWN0ZWQ+7Jik7ZuEPC9vcHRpb24+PC9zZWxlY3Q+CiAgICAgIDxzZWxlY3QgaWQ9ImRjSDEiIHN0eWxlPSJwYWRkaW5nOjEwcHggNHB4O2JvcmRlcjpub25lO2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjcwMDtmb250LWZhbWlseTppbmhlcml0O3RleHQtYWxpZ246Y2VudGVyO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Y29sb3I6IzMzNDE1NTtvdXRsaW5lOm5vbmU7Y3Vyc29yOnBvaW50ZXI7ZmxleDoxIj48b3B0aW9uIHZhbHVlPSIxIj4x7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMiI+MuyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjMiPjPsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI0Ij407IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iNSI+NeyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjYiPjbsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI3Ij437IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iOCI+OOyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjkiPjnsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIxMCI+MTDsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIxMSI+MTHsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIxMiI+MTLsi5w8L29wdGlvbj48L3NlbGVjdD4KICAgICAgPHNlbGVjdCBpZD0iZGNNMSIgc3R5bGU9InBhZGRpbmc6MTBweCA0cHg7Ym9yZGVyOm5vbmU7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtZmFtaWx5OmluaGVyaXQ7dGV4dC1hbGlnbjpjZW50ZXI7YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjojMzM0MTU1O291dGxpbmU6bm9uZTtjdXJzb3I6cG9pbnRlcjtmbGV4OjEiPjxvcHRpb24gdmFsdWU9IjAwIj4wMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjEwIj4xMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjIwIj4yMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjMwIj4zMOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjQwIj40MOu2hDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjUwIj41MOu2hDwvb3B0aW9uPjwvc2VsZWN0PgogICAgPC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7bWFyZ2luLWJvdHRvbTo0cHg7Y29sb3I6Izg4OCI+7KKF66OMPC9kaXY+CiAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7Ym9yZGVyOjJweCBzb2xpZCAjZTJlOGYwO2JvcmRlci1yYWRpdXM6MTBweDtvdmVyZmxvdzpoaWRkZW47YmFja2dyb3VuZDojZjhmYWZjO21hcmdpbi1ib3R0b206MTZweCI+CiAgICAgIDxzZWxlY3QgaWQ9ImRjQVAyIiBzdHlsZT0icGFkZGluZzoxMHB4IDRweDtib3JkZXI6bm9uZTtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7Zm9udC1mYW1pbHk6aW5oZXJpdDt0ZXh0LWFsaWduOmNlbnRlcjtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50O2NvbG9yOiMzMzQxNTU7b3V0bGluZTpub25lO2N1cnNvcjpwb2ludGVyO2ZsZXg6MSI+PG9wdGlvbiB2YWx1ZT0i7Jik7KCEIj7smKTsoIQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSLsmKTtm4QiIHNlbGVjdGVkPuyYpO2bhDwvb3B0aW9uPjwvc2VsZWN0PgogICAgICA8c2VsZWN0IGlkPSJkY0gyIiBzdHlsZT0icGFkZGluZzoxMHB4IDRweDtib3JkZXI6bm9uZTtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo3MDA7Zm9udC1mYW1pbHk6aW5oZXJpdDt0ZXh0LWFsaWduOmNlbnRlcjtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50O2NvbG9yOiMzMzQxNTU7b3V0bGluZTpub25lO2N1cnNvcjpwb2ludGVyO2ZsZXg6MSI+PG9wdGlvbiB2YWx1ZT0iMSI+MeyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjIiPjLsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIzIj4z7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iNCI+NOyLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjUiPjXsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI2Ij427IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iNyI+N+yLnDwvb3B0aW9uPjxvcHRpb24gdmFsdWU9IjgiPjjsi5w8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI5Ij457IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMTAiPjEw7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMTEiPjEx7IucPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT0iMTIiPjEy7IucPC9vcHRpb24+PC9zZWxlY3Q+CiAgICAgIDxzZWxlY3QgaWQ9ImRjTTIiIHN0eWxlPSJwYWRkaW5nOjEwcHggNHB4O2JvcmRlcjpub25lO2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjcwMDtmb250LWZhbWlseTppbmhlcml0O3RleHQtYWxpZ246Y2VudGVyO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Y29sb3I6IzMzNDE1NTtvdXRsaW5lOm5vbmU7Y3Vyc29yOnBvaW50ZXI7ZmxleDoxIj48b3B0aW9uIHZhbHVlPSIwMCI+MDDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIxMCI+MTDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIyMCI+MjDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSIzMCI+MzDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI0MCI+NDDrtoQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPSI1MCI+NTDrtoQ8L29wdGlvbj48L3NlbGVjdD4KICAgIDwvZGl2PgogICAgPGRpdiBjbGFzcz0ibW9kYWwtYnRucyI+CiAgICAgIDxidXR0b24gb25jbGljaz0iZG9EYXRlQ2hhbmdlKCkiIHN0eWxlPSJiYWNrZ3JvdW5kOiMwRjZFNTY7Y29sb3I6I2ZmZiI+67OA6rK9PC9idXR0b24+CiAgICAgIDxidXR0b24gb25jbGljaz0iY2xvc2VEYXRlQ2hhbmdlKCkiIHN0eWxlPSJiYWNrZ3JvdW5kOiNlMmU4ZjA7Y29sb3I6IzY0NzQ4YiI+7Leo7IaMPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2Rpdj4KPC9kaXY+CjxkaXYgY2xhc3M9InRvYXN0LXdyYXAiIGlkPSJ0b2FzdFdyYXAiPjwvZGl2Pgo8L2JvZHk+CjwvaHRtbD4K';
var PROPOSAL_HTML='';
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

var CONFIG={
  SPREADSHEET_ID:'1v0dGo311Nk-4UQIbucA7C-f71EAQVVbWn75Uo_USmzQ',
  TAB_MASTER:'상품DB(바코드 프로토타입)',TAB_MEMBERS:'MEMBER',
  TAB_ORDERS:'발주이력',TAB_BROADCASTS:'방송이력',
  TAB_INVENTORY:'통합재고',TAB_PROPOSALS:'제안서',
  COL_PRODUCT_CODE:2,COL_BARCODE:3,COL_PRODUCT_NAME:5,
  COL_SELL_PRICE:9,COL_SUPPLY_PRICE:11,COL_STOCK:8,COL_SUPPLIER:15,
  OPENAI_KEY:'***REDACTED***',
  GEMINI_KEY:'***REDACTED***',
  NAVER_CLIENT_ID:'***REDACTED***',NAVER_CLIENT_SECRET:'***REDACTED***',
  WMS_TABS:[
    {name:'한국무진WMS업로드',bcCol:15,stCol:18,nameCol:7,supplyCol:9,sellCol:10,codeCol:0},
    {name:'쓰리백WMS업로드',bcCol:10,stCol:9,nameCol:3,supplyCol:7,sellCol:8,codeCol:2},
    {name:'거래처2WMS업로드',bcCol:15,stCol:16,nameCol:7,supplyCol:9,sellCol:10,codeCol:5},
    {name:'거래처3WMS업로드',bcCol:15,stCol:16,nameCol:7,supplyCol:9,sellCol:10,codeCol:5}
  ]
};

function getSS(){return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)}

// ════════════════════════════════════════════════════════════
// 헤더맵 유틸
// ════════════════════════════════════════════════════════════

function buildHeaderMap(h){
  var m={};
  for(var i=0;i<h.length;i++){var k=String(h[i]||'').trim();if(k)m[k]=i;}
  return m;
}
function hGet(row,hm,col,def){
  if(def===undefined)def='';
  var idx=hm[col];
  if(idx===undefined||idx===null)return def;
  var v=row[idx];
  return(v===undefined||v===null||v==='')? def:v;
}
function hNum(row,hm,col){return Number(hGet(row,hm,col,0))||0;}
function hStr(row,hm,col){return String(hGet(row,hm,col,'')||'').trim();}
function hDate(row,hm,col){return hStr(row,hm,col).substring(0,10);}

// ════════════════════════════════════════════════════════════
// ★ 발주서 컬럼 구조 (A~O 고정, 절대 변경 금지)
// A:주문번호  B:수령자    C:연락처    D:주소      E:날짜
// F:상품명    G:옵션      H:수량      I:배송메시지 J:입금액
// K:공급가(개당) L:공급가(합계) M:마진  N:바코드    O:주문시간
// P:셀러명(시스템) Q:입금상태(시스템) R:출고상태(시스템)
// ════════════════════════════════════════════════════════════

var ORDER_COLS=[
  '주문번호',    // A  col 0
  '수령자',      // B  col 1
  '연락처',      // C  col 2
  '주소',        // D  col 3
  '날짜',        // E  col 4
  '상품명',      // F  col 5
  '옵션',        // G  col 6
  '수량',        // H  col 7
  '배송메시지',  // I  col 8
  '입금액',      // J  col 9
  '공급가(개당)',// K  col 10
  '공급가(합계)',// L  col 11
  '마진',        // M  col 12
  '바코드',      // N  col 13
  '주문시간',    // O  col 14
  '셀러명',      // P  col 15 (시스템)
  '입금상태',    // Q  col 16 (시스템)
  '출고상태'     // R  col 17 (시스템)
];

// ════════════════════════════════════════════════════════════
// ★ 캐시 유틸 (성능 최적화 핵심)
// ════════════════════════════════════════════════════════════

function cacheSet(key,value,sec){
  try{CacheService.getScriptCache().put(key,JSON.stringify(value),sec||60);}catch(e){}
}

function cacheGet(key){
  try{
    var v=CacheService.getScriptCache().get(key);
    return v? JSON.parse(v):null;
  }catch(e){return null}
}

function cacheDelete(key){
  try{CacheService.getScriptCache().remove(key);}catch(e){}
}

// ════════════════════════════════════════════════════════════
// ★ 발주 데이터 고속 조회 (캐시 30초)
// 반환: [헤더행, 데이터행1, 데이터행2, ...]
// → 기존 d[0]=헤더, d[1..]=데이터 구조 그대로 유지
// ════════════════════════════════════════════════════════════

function getOrderDataFast(){
  var cacheKey='orders_all';
  var cached=cacheGet(cacheKey);
  if(cached)return cached;

  var ws=getSS().getSheetByName(CONFIG.TAB_ORDERS);
  if(!ws)return[ORDER_COLS];

  var last=ws.getLastRow();
  if(last<2)return[ORDER_COLS];

  var data=ws.getRange(2,1,last-1,ORDER_COLS.length).getValues();
  var result=[ORDER_COLS].concat(data); // 헤더 포함 반환 → 기존 로직 호환

  cacheSet(cacheKey,result,30);
  return result;
}

// 발주 캐시 전체 초기화 (쓰기 작업 후 호출)
function invalidateOrderCache(){
  cacheDelete('orders_all');
  cacheDelete('order_summary');
  cacheDelete('order_stats');
  cacheDelete('admin_summary');
}

// ════════════════════════════════════════════════════════════
// ★ MEMBER 고속 조회 (캐시 300초)
// ════════════════════════════════════════════════════════════

function getMemberData(){
  var cacheKey='member_all';
  var cached=cacheGet(cacheKey);
  if(cached)return cached;

  var ws=getSS().getSheetByName('MEMBER');
  if(!ws)return[];

  var last=ws.getLastRow();
  if(last<2)return[];

  var data=ws.getRange(2,1,last-1,12).getValues();
  cacheSet(cacheKey,data,300);
  return data;
}

function getMemberMap(){
  var cacheKey='member_map';
  var cached=cacheGet(cacheKey);
  if(cached)return cached;

  var data=getMemberData();
  var map={};
  for(var i=0;i<data.length;i++){
    if(data[i][0])map[String(data[i][0]).trim()]=data[i];
  }
  cacheSet(cacheKey,map,300);
  return map;
}

function invalidateMemberCache(){
  cacheDelete('member_all');
  cacheDelete('member_map');
}

// ════════════════════════════════════════════════════════════
// 발주 시트 초기화
// ════════════════════════════════════════════════════════════

function initOrderHeaders(ws){
  if(ws.getLastRow()>0)ws.clear();
  ws.getRange(1,1,1,ORDER_COLS.length).setValues([ORDER_COLS])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff');
  ws.setFrozenRows(1);
  var w={
    '주문번호':130,'수령자':90,'연락처':120,'주소':200,'날짜':100,
    '상품명':160,'옵션':70,'수량':60,'배송메시지':140,'입금액':90,
    '공급가(개당)':90,'공급가(합계)':90,'마진':80,'바코드':150,
    '주문시간':140,'셀러명':90,'입금상태':80,'출고상태':80
  };
  for(var i=0;i<ORDER_COLS.length;i++){
    if(w[ORDER_COLS[i]])ws.setColumnWidth(i+1,w[ORDER_COLS[i]]);
  }
  try{
    var hm=buildHeaderMap(ORDER_COLS);
    ws.getRange(2,hm['입금상태']+1,500,1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['입금확인전','입금완료']).build());
    ws.getRange(2,hm['출고상태']+1,500,1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['대기','발송준비','출고완료','부분출고']).build());
  }catch(e){}
  invalidateOrderCache();
}

function resetAndInitOrders(){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_ORDERS);
    if(!ws)ws=ss.insertSheet(CONFIG.TAB_ORDERS);
    initOrderHeaders(ws);return{ok:true};
  }catch(e){return{ok:false,msg:e.message}}
}

// ════════════════════════════════════════════════════════════
// ★ 로그인 (캐시 300초 - 속도 10배 향상)
// ════════════════════════════════════════════════════════════

function doLogin(id,pw){
  try{
    var iid=String(id||'').trim(),ipw=String(pw||'').trim();
    if(!iid||!ipw)return{ok:false,msg:'아이디와 비밀번호를 입력하세요.'};

    // 슈퍼계정
    if(iid==='super'&&ipw==='mujin')
      return{ok:true,user:{id:'super',name:'슈퍼무진',role:'마스터',org:'',status:'마스터'}};

    // 캐시 확인
    var cacheKey='login_'+iid;
    var cached=cacheGet(cacheKey);
    if(cached&&cached.pw===ipw)return{ok:true,user:cached.user};

    // MEMBER 고속 조회
    var data=getMemberData();
    for(var i=0;i<data.length;i++){
      var row=data[i];
      if(!row[0])continue;
      var rid=String(row[0]||'').trim(),rpw=String(row[1]||'').trim(),rst=String(row[5]||'').trim();
      if(rid.toLowerCase()!==iid.toLowerCase())continue;
      if(rpw!==ipw)return{ok:false,msg:'비밀번호가 올바르지 않습니다.'};
      if(rst.indexOf('차단')>=0)return{ok:false,msg:'차단된 계정입니다.'};
      if(rst==='승인대기'||rst==='가입대기'||rst==='가입')return{ok:false,msg:'승인 대기 중입니다.'};
      var role=_resolveRole(rst);
      var user={id:rid,name:String(row[2]||'').trim()||rid,phone:String(row[3]||'').trim(),
        email:String(row[6]||'').trim(),role:role,
        org:String(row[10]||'').trim()||String(row[11]||'').trim(),status:rst};
      cacheSet(cacheKey,{pw:ipw,user:user},300);
      return{ok:true,user:user};
    }
    return{ok:false,msg:'아이디 또는 비밀번호가 올바르지 않습니다.'};
  }catch(e){return{ok:false,msg:'로그인 오류: '+e.message}}
}

// ════════════════════════════════════════════════════════════
// 발주 저장 (저장 후 캐시 초기화)
// ════════════════════════════════════════════════════════════

function submitBulkOrder(data){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_ORDERS);
    if(!ws){ws=ss.insertSheet(CONFIG.TAB_ORDERS);initOrderHeaders(ws);}
    var hRow=ws.getRange(1,1,1,ws.getLastColumn()).getValues()[0];
    var dbHm=buildHeaderMap(hRow);
    if(dbHm['주문번호']===undefined){
      initOrderHeaders(ws);
      hRow=ws.getRange(1,1,1,ws.getLastColumn()).getValues()[0];
      dbHm=buildHeaderMap(hRow);
    }
    var ds=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
    var ns=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm');
    var lr=ws.getLastRow(),orders=data.orders||[],rows=[],tA=0,tM=0,tS=0,buyers={};
    var products=getProductList(),pMap={};
    products.forEach(function(p){if(p.barcode)pMap[normBarcode(p.barcode)]=p;});
    for(var i=0;i<orders.length;i++){
      var o=orders[i];
      function pick(names,def){
        for(var n=0;n<names.length;n++){
          if(o[names[n]]!==undefined){var v=String(o[names[n]]||'').trim();if(v)return v;}
        }
        return def||'';
      }
      var orderNo  =pick(['주문번호','orderNo'],'');
      var recipient=pick(['수령자','주문자','받는분','수령인','buyer'],'');
      var phone    =pick(['연락처','전화번호','phone','수령자연락처','받는분연락처'],'');
      var addr     =pick(['주소','배송주소','address','배송지','받는분주소'],'');
      var date     =(pick(['날짜','주문날짜','일자','주문일','주문일시'],ds)||'').substring(0,10)||ds;
      var pname    =pick(['상품명','제품명','productName','상품','품목명'],'');
      var option   =pick(['옵션','옵션명','option','상품옵션'],'');
      var qty      =Number(pick(['수량','qty','주문수량','주문수'],'1'))||1;
      var delMsg   =pick(['배송메시지','배송요청사항','배송메모','배송요청','배송지요청사항'],'');
      var bc       =pick(['바코드','barcode','상품바코드','상품코드'],'');
      var ot       =pick(['주문시간','주문일시','orderTime'],ns);
      if(!option&&!delMsg&&o['옵션/메모']){
        var cm=String(o['옵션/메모']||'').trim();
        if(cm.indexOf('배송:')>=0||cm.indexOf('배송메시지:')>=0)delMsg=cm;
        else option=cm;
      }
      if(!option&&o['옵션정보'])option=String(o['옵션정보']||'');
      if(!delMsg&&o['배송요청'])delMsg=String(o['배송요청']||'');
      var amt=Number(pick(['입금액','판매가','amount','결제금액','주문금액'],'0'))||0;
      var su =Number(pick(['공급가(개당)','공급가','단가','매입가'],'0'))||0;
      var st =Number(pick(['공급가(합계)','공급가합계'],'0'))||0;
      var mrg=Number(pick(['마진','수익','이익'],'0'))||0;
      if(!su&&bc){var pr=pMap[normBarcode(bc)];if(pr)su=pr.supplyPrice||0;}
      if(!st&&su)st=su*qty;if(!mrg&&amt>0&&st>0)mrg=amt-st;
      if(!orderNo)orderNo='ORD-'+ds.replace(/-/g,'')+'-'+(lr+i+1);
      var row=new Array(ORDER_COLS.length).fill('');
      function sc(cn,val){var idx=dbHm[cn];if(idx!==undefined)row[idx]=val;}
      sc('주문번호',orderNo);sc('수령자',recipient);sc('연락처',phone);
      sc('주소',addr);sc('날짜',date);sc('상품명',pname);
      sc('옵션',option);sc('수량',qty);sc('배송메시지',delMsg);
      sc('입금액',amt);sc('공급가(개당)',su);sc('공급가(합계)',st);
      sc('마진',mrg);sc('바코드',bc);sc('주문시간',ot);
      sc('셀러명',data.seller||'');sc('입금상태','입금확인전');sc('출고상태','대기');
      rows.push(row);tA+=amt;tM+=mrg;tS+=st;
      if(phone||recipient)buyers[phone||recipient]=true;
    }
    if(rows.length>0)ws.getRange(lr+1,1,rows.length,ORDER_COLS.length).setValues(rows);
    cacheDelete('orders_all');
    cacheDelete('order_summary');
    cacheDelete('admin_summary');
    invalidateOrderCache();
    return{ok:true,count:rows.length,buyers:Object.keys(buyers).length,
      totalAmount:tA,totalMargin:tM,totalSupply:tS};
  }catch(e){return{ok:false,msg:e.message}}
}

// ════════════════════════════════════════════════════════════
// ★ 발주 조회 (getOrderDataFast 사용 - 캐시 조회)
// ════════════════════════════════════════════════════════════

function getRecentOrderBatches(role,userName){
  try{
    var d=getOrderDataFast();
    if(!d||d.length<2)return[];
    var hm=buildHeaderMap(d[0]);
    var isM=(role==='마스터'||role==='부마스터');
    var isA=(role==='관리자');
    var isSeller=(role==='셀러');
    var ms=isA?getSellersByAdmin(userName):{};
    var batches={};
    for(var i=1;i<d.length;i++){
      var row=d[i];
      var dt=hDate(row,hm,'날짜'),seller=hStr(row,hm,'셀러명');
      if(!dt||!seller)continue;
      if(isM){}
      else if(isSeller){if(seller!==userName)continue;}
      else if(isA){if(!ms[seller])continue;}
      else{if(seller!==userName)continue;}
      var key=dt+'_'+seller;
      if(!batches[key])batches[key]={
        date:dt,seller:seller,count:0,totalQty:0,
        amount:0,supplyCost:0,margin:0,
        mainStatus:'대기',payStatus:'입금확인전',
        paidCount:0,shipDoneCount:0,shipReadyCount:0,
        buyers:{}
      };
      var b=batches[key];b.count++;
      b.totalQty+=hNum(row,hm,'수량');
      b.amount+=hNum(row,hm,'입금액');
      b.supplyCost+=hNum(row,hm,'공급가(합계)');
      b.margin+=hNum(row,hm,'마진');
      var buyer=hStr(row,hm,'수령자')||hStr(row,hm,'연락처');
      if(buyer)b.buyers[buyer]=true;
      var ps=hStr(row,hm,'입금상태')||'입금확인전';
      var ss2=hStr(row,hm,'출고상태')||'대기';
      if(ps==='입금완료')b.paidCount++;
      if(ss2==='출고완료')b.shipDoneCount++;
      else if(ss2==='발송준비')b.shipReadyCount++;
    }
    var list=[];
    for(var k in batches){
      if(!batches.hasOwnProperty(k))continue;
      var b=batches[k];
      b.buyerCount=Object.keys(b.buyers).length;
      delete b.buyers;
      // 전체 기준으로 상태 결정
      b.payStatus=b.paidCount===b.count?'입금완료':'입금확인전';
      if(b.shipDoneCount===b.count)b.mainStatus='출고완료';
      else if(b.shipDoneCount>0)b.mainStatus='부분출고';
      else if(b.shipReadyCount>0)b.mainStatus='발송준비';
      else b.mainStatus='대기';
      list.push(b);
    }
    list.sort(function(a,b){return b.date.localeCompare(a.date)||b.amount-a.amount});
    return list.slice(0,20);
  }catch(e){Logger.log('getRecentOrderBatches:'+e.message);return[]}
}

function getOrdersByDate(date){
  try{
    var d=getOrderDataFast(); // ★ 캐시 조회
    if(!d||d.length<2)return{ok:false};
    var hm=buildHeaderMap(d[0]),orders=[];
    for(var i=1;i<d.length;i++){
      var row=d[i];if(hDate(row,hm,'날짜')!==date)continue;
      orders.push({row:i+1,
        orderNo:hStr(row,hm,'주문번호'),
        buyer:hStr(row,hm,'수령자')||hStr(row,hm,'연락처'),
        product:hStr(row,hm,'상품명').substring(0,20),
        qty:hNum(row,hm,'수량'),amount:hNum(row,hm,'입금액'),
        payStatus:hStr(row,hm,'입금상태')||'입금확인전',
        shipStatus:hStr(row,hm,'출고상태')||'대기'});
    }
    return{ok:true,orders:orders};
  }catch(e){return{ok:false,msg:e.message}}
}

function updateSingleOrderStatus(row,field,value){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_ORDERS);
    if(!ws)return{ok:false,msg:'시트 없음'};
    var hm=buildHeaderMap(ws.getRange(1,1,1,ws.getLastColumn()).getValues()[0]);
    var col=(field==='pay')?hm['입금상태']:hm['출고상태'];
    if(col===undefined)return{ok:false,msg:'컬럼 없음'};
    ws.getRange(row,col+1).setValue(value);
    SpreadsheetApp.flush();
    invalidateOrderCache();
    return{ok:true};
  }catch(e){return{ok:false,msg:e.message}}
}

function getShipColor(st){
  if(st==='출고완료')return{bg:'#d1fae5',color:'#065f46'};
  if(st==='발송준비')return{bg:'#dbeafe',color:'#1e40af'};
  if(st==='부분출고')return{bg:'#fef9c3',color:'#854d0e'};
  return{bg:'#f1f5f9',color:'#64748b'};
}
function updateOrderStatus(orderId,statusType,value){
  try{
    var ws=getSS().getSheetByName(CONFIG.TAB_ORDERS);
    if(!ws)return{ok:false};
    var d=ws.getDataRange().getValues();
    var hm=buildHeaderMap(d[0]);
    for(var i=1;i<d.length;i++){
      if(String(d[i][hm['주문번호']]||'')==String(orderId)){
        if(statusType==='입금')ws.getRange(i+1,hm['입금상태']+1).setValue(value);
        if(statusType==='출고')ws.getRange(i+1,hm['출고상태']+1).setValue(value);
        SpreadsheetApp.flush();
        invalidateOrderCache();
        return{ok:true};
      }
    }
    return{ok:false};
  }catch(e){return{ok:false,msg:e.message}}
}

function bulkUpdateOrderStatus(date,field,value){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_ORDERS);
    if(!ws)return{ok:false,msg:'시트 없음'};
    var d=ws.getDataRange().getValues(),hm=buildHeaderMap(d[0]);
    var col=(field==='pay')?hm['입금상태']:hm['출고상태'];
    if(col===undefined)return{ok:false,msg:'컬럼 없음'};
    var count=0;
    for(var i=1;i<d.length;i++){
      var rowDate=hDate(d[i],hm,'날짜');
      if(rowDate===date){
        ws.getRange(i+1,col+1).setValue(value);
        count++;
      }
    }
    SpreadsheetApp.flush();
    cacheDelete('orders_all');
    cacheDelete('order_summary');
    cacheDelete('order_stats');
    cacheDelete('admin_summary');
    return{ok:true,count:count};
  }catch(e){return{ok:false,msg:e.message}}
}

function getSellerOrderHistory(sellerName){
  try{
    if(!sellerName)return{ok:true,orders:[]};
    var d=getOrderDataFast(); // ★ 캐시 조회
    if(!d||d.length<2)return{ok:true,orders:[]};
    var hm=buildHeaderMap(d[0]),orders=[];
    for(var i=1;i<d.length;i++){
      var row=d[i];if(hStr(row,hm,'셀러명')!==String(sellerName).trim())continue;
      orders.push({
        orderNo:hStr(row,hm,'주문번호'),buyer:hStr(row,hm,'수령자'),
        phone:hStr(row,hm,'연락처'),address:hStr(row,hm,'주소'),
        orderDate:hDate(row,hm,'날짜'),product:hStr(row,hm,'상품명'),
        option:hStr(row,hm,'옵션'),qty:hNum(row,hm,'수량'),
        delMsg:hStr(row,hm,'배송메시지'),payment:hNum(row,hm,'입금액'),
        costPer:hNum(row,hm,'공급가(개당)'),costTotal:hNum(row,hm,'공급가(합계)'),
        margin:hNum(row,hm,'마진'),barcode:hStr(row,hm,'바코드'),
        orderTime:hStr(row,hm,'주문시간'),seller:hStr(row,hm,'셀러명'),
        payStatus:hStr(row,hm,'입금상태'),shipStatus:hStr(row,hm,'출고상태')
      });
    }
    orders.sort(function(a,b){return b.orderDate.localeCompare(a.orderDate)});
    return{ok:true,orders:orders};
  }catch(e){return{ok:false,error:e.message}}
}

function deleteOrderBatch(date,seller){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_ORDERS);if(!ws)return{ok:true};
    var d=ws.getDataRange().getValues(),hm=buildHeaderMap(d[0]),keep=[d[0]];
    for(var i=1;i<d.length;i++){
      var dt=hDate(d[i],hm,'날짜'),sl=hStr(d[i],hm,'셀러명');
      if(!(dt===date&&(!seller||sl===seller)))keep.push(d[i]);
    }
    ws.clearContents();
    if(keep.length>0)ws.getRange(1,1,keep.length,keep[0].length).setValues(keep);
    invalidateOrderCache(); // ★ 삭제 후 캐시 초기화
    return{ok:true};
  }catch(e){return{ok:false,msg:e.message}}
}

function resetOrderHistory(){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_ORDERS);if(!ws)return{ok:true};
    var lr=ws.getLastRow();if(lr>1)ws.deleteRows(2,lr-1);
    invalidateOrderCache(); // ★ 초기화 후 캐시 초기화
    return{ok:true};
  }catch(e){return{ok:false,msg:e.message}}
}

// ════════════════════════════════════════════════════════════
// ★ 판매현황 (캐시 조회)
// ════════════════════════════════════════════════════════════

function getPerformanceData(role,name,fromDate,toDate){
  try{
    var d=getOrderDataFast();
    if(!d||d.length<2)return[];
    var hm=buildHeaderMap(d[0]);
    var isM=(role==='마스터'||role==='부마스터');
    var isA=(role==='관리자');
    var isSeller=(role==='셀러');
    var ms=isA?getSellersByAdmin(name):{},groups={};
    for(var i=1;i<d.length;i++){
      var row=d[i],seller=hStr(row,hm,'셀러명'),dt=hDate(row,hm,'날짜');
      if(!dt)continue;
      if(isM){}
      else if(isSeller){if(seller!==name)continue}
      else if(isA){if(!ms[seller])continue}
      else{if(seller!==name)continue}
      if(fromDate&&dt<fromDate)continue;if(toDate&&dt>toDate)continue;
      var key=(isM||isA)?seller:dt;
      if(!groups[key])groups[key]={label:key,count:0,amount:0,supply:0,margin:0};
      groups[key].count++;
      groups[key].amount+=hNum(row,hm,'입금액');
      groups[key].supply+=hNum(row,hm,'공급가(합계)');
      groups[key].margin+=hNum(row,hm,'마진');
    }
    var list=[];for(var k in groups){if(groups.hasOwnProperty(k))list.push(groups[k]);}
    list.sort(function(a,b){return b.amount-a.amount});return list;
  }catch(e){return[]}
}

// ════════════════════════════════════════════════════════════
// ★ 내 셀러 (getMemberData 캐시 조회)
// ════════════════════════════════════════════════════════════

function _normVal(v){
  if(v===undefined||v===null)return'';
  return String(v).replace(/\.0+$/,'').replace(/[\t\r\n]/g,' ').trim();
}
function _resolveRole(s){
  var st=_normVal(s).trim();
  if(st==='마스터')return'마스터';
  if(st==='부마스터')return'부마스터';
  if(st==='관리자')return'관리자';
  if(st==='셀러')return'셀러';
  // 하위 호환
  if(st.indexOf('부마스터')>=0)return'부마스터';
  if(st.indexOf('마스터')>=0)return'마스터';
  if(st.indexOf('관리자')>=0)return'관리자';
  return'셀러';
}
function _buildSellerObj(r){
  return{
    id:_normVal(r[0]),name:_normVal(r[2])||_normVal(r[0]),
    phone:_normVal(r[3]),joinDate:_normVal(r[4]),status:_normVal(r[5]),
    email:_normVal(r[6]),channels:_normVal(r[8]),
    sales:Number(_normVal(r[9]))||0,org:_normVal(r[10])||_normVal(r[11])
  };
}

function getMySellers(adminNameOrId){
  try{
    var inp=_normVal(adminNameOrId);
    if(!inp)return{ok:true,sellers:[]};

    var data=getMemberData(); // ★ 캐시 조회
    var aN='',aI='',aR='';
    for(var i=0;i<data.length;i++){
      var rId=_normVal(data[i][0]),rNm=_normVal(data[i][2]),rSt=_normVal(data[i][5]);
      if(rNm===inp||rId===inp){aN=rNm;aI=rId;aR=_resolveRole(rSt);break;}
    }
    if(!aN){aN=inp;aI=inp;}
    var isM=(aR==='마스터'||aR==='부마스터'),list=[];
    for(var i=0;i<data.length;i++){
      if(!data[i][0])continue;
      var st=_normVal(data[i][5]),rc=_resolveRole(st);
      if(rc==='마스터'||rc==='부마스터'||rc==='관리자')continue;
      if(st==='승인대기'||st==='차단'||st==='가입')continue;
      if(isM){list.push(_buildSellerObj(data[i]));}
      else{
        var oK=_normVal(data[i][10]),oL=_normVal(data[i][11]);
        if(oK===aN||oK===aI||oL===aN||oL===aI)list.push(_buildSellerObj(data[i]));
      }
    }
    return{ok:true,sellers:list};
  }catch(e){return{ok:false,sellers:[],msg:e.message}}
}

function getSellersByAdmin(adminName){
  try{
    var data=getMemberData(); // ★ 캐시 조회
    var sellers={};
    sellers[adminName]=true;var aId='';
    for(var i=0;i<data.length;i++){
      if(String(data[i][2]||'').trim()===adminName){aId=String(data[i][0]||'').trim();break;}
    }
    for(var i=0;i<data.length;i++){
      var nm=String(data[i][2]||data[i][0]||'').trim(),found=false;
      for(var c=10;c<=12&&c<data[i].length;c++){
        var v=String(data[i][c]||'').trim();
        if(v&&(v===adminName||(aId&&v===aId))){found=true;break;}
      }
      if(found&&nm)sellers[nm]=true;
    }
    return sellers;
  }catch(e){return{}}
}

function getAllSellers(){
  try{
    var data=getMemberData(); // ★ 캐시 조회
    var list=[];
    for(var i=0;i<data.length;i++){
      if(!data[i][0])continue;
      var st=String(data[i][5]||'').trim();
      if(st==='마스터'||st==='부마스터'||st==='관리자'||st==='승인대기'||st==='차단'||st==='가입')continue;
      list.push({id:String(data[i][0]||''),name:String(data[i][2]||data[i][0]||''),
        phone:String(data[i][3]||''),email:String(data[i][6]||''),status:st,
        channels:String(data[i][8]||''),avgSales:String(data[i][9]||''),
        org:String(data[i][10]||'')||String(data[i][11]||'')});
    }
    return list;
  }catch(e){return[]}
}

function getSellerProfileAndStats(sellerName){
  try{
    var profile={name:sellerName,phone:'',email:'',channels:'',avgSales:'',org:''};
    var data=getMemberData();
    for(var i=0;i<data.length;i++){
      if(String(data[i][2]||data[i][0]||'').trim()===sellerName){
        profile.phone=String(data[i][3]||'');
        profile.email=String(data[i][6]||'');
        profile.channels=String(data[i][8]||'');
        profile.avgSales=String(data[i][9]||'');
        profile.org=String(data[i][10]||'');
        break;
      }
    }
    var stats={totalSales:0,totalMargin:0,totalOrders:0,confirmedSales:0,confirmedMargin:0,confirmedOrders:0};
    var od=getOrderDataFast();
    if(od&&od.length>1){
      var hm=buildHeaderMap(od[0]);
      for(var i=1;i<od.length;i++){
        if(hStr(od[i],hm,'셀러명')===sellerName){
          stats.totalOrders++;
          stats.totalSales+=hNum(od[i],hm,'입금액');
          stats.totalMargin+=hNum(od[i],hm,'마진');
          var ps=hStr(od[i],hm,'입금상태');
          var ss=hStr(od[i],hm,'출고상태');
          if(ps==='입금완료'&&ss==='출고완료'){
            stats.confirmedOrders++;
            stats.confirmedSales+=hNum(od[i],hm,'입금액');
            stats.confirmedMargin+=hNum(od[i],hm,'마진');
          }
        }
      }
    }
    return{ok:true,profile:profile,stats:stats};
  }catch(e){return{ok:false}}
}

// ════════════════════════════════════════════════════════════
// ★ 전체관리 (캐시 조회)
// ════════════════════════════════════════════════════════════

function debugAdminMapping(){
  try{
    var md=getMemberData();
    var od=getOrderDataFast();

    Logger.log('=== MEMBER 데이터 ===');
    for(var i=0;i<md.length;i++){
      var nm=String(md[i][2]||'').trim();
      var st=String(md[i][5]||'').trim();
      var og=String(md[i][10]||'').trim();
      if(nm)Logger.log('이름:'+nm+' | 상태:'+st+' | 소속조직:'+og);
    }

    Logger.log('=== 발주 셀러명 ===');
    if(od&&od.length>1){
      var hm=buildHeaderMap(od[0]);
      var sellers={};
      for(var i=1;i<od.length;i++){
        var sl=hStr(od[i],hm,'셀러명');
        if(sl)sellers[sl]=true;
      }
      Logger.log(JSON.stringify(Object.keys(sellers)));
    }
  }catch(e){Logger.log('오류:'+e.message)}
}

function getAdminDashboard(){
  try{
    var cached=cacheGet('admin_summary');
    if(cached)return cached;

    var md=getMemberData();

// 1단계: 관리자 생성 (C열=이름, F열=상태)
    var admins={};
    for(var i=0;i<md.length;i++){
      var st=String(md[i][5]||'').trim();
      var nm=String(md[i][2]||'').trim();
      var og=String(md[i][10]||'').trim();
      if(!nm)continue;
      if(st==='관리자'||st==='마스터'||st==='부마스터'){
        admins[nm]={name:nm,org:og,role:st,sellers:[],totalOrders:0,totalSales:0,totalMargin:0};
      }
    }

    // 2단계: 셀러 → 관리자 매핑
    // 셀러의 K열(소속조직) = 관리자의 C열(이름) 기준
    var sellerToAdmin={};
    for(var i=0;i<md.length;i++){
      var st=String(md[i][5]||'').trim();
      var nm=String(md[i][2]||'').trim();
      var og=String(md[i][10]||'').trim();
      if(st!=='셀러'||!nm||!og)continue;
      // og = 관리자 이름과 비교
      if(admins[og]){
        sellerToAdmin[nm]=og;
        if(admins[og].sellers.indexOf(nm)<0)admins[og].sellers.push(nm);
      }
    }

    // 3단계: 매출 집계 (입금완료+출고완료만 인정)
    var od=getOrderDataFast();
    if(od&&od.length>1){
      var hm=buildHeaderMap(od[0]);
      for(var i=1;i<od.length;i++){
        var seller=hStr(od[i],hm,'셀러명');
        if(!seller)continue;
        var admin=sellerToAdmin[seller];
        if(!admin&&admins[seller])admin=seller;
        if(!admin)continue;
        var payStatus=hStr(od[i],hm,'입금상태')||'';
        var shipStatus=hStr(od[i],hm,'출고상태')||'';
        var payOk=(payStatus==='입금완료');
        var shipOk=(shipStatus==='출고완료');
        admins[admin].totalOrders++;
        admins[admin].totalSales+=hNum(od[i],hm,'입금액');
        admins[admin].totalMargin+=hNum(od[i],hm,'마진');
        if(payOk&&shipOk){
          admins[admin].confirmedSales=(admins[admin].confirmedSales||0)+hNum(od[i],hm,'입금액');
          admins[admin].confirmedMargin=(admins[admin].confirmedMargin||0)+hNum(od[i],hm,'마진');
        }
      }
    }

    var list=[];
    for(var k in admins){
      if(!admins.hasOwnProperty(k))continue;
      var a=admins[k];
      var rt=a.totalSales>0?Math.round(a.totalMargin/a.totalSales*100):0;
      list.push({
        name:a.name,role:a.role,org:a.org,
        sellers:a.sellers,sellerCount:a.sellers.length,
        totalSales:a.totalSales,totalMargin:a.totalMargin,
        totalOrders:a.totalOrders,marginRate:rt
      });
    }
    list.sort(function(a,b){return b.totalSales-a.totalSales});
    cacheSet('admin_summary',list,30);
    return list;
  }catch(e){Logger.log('getAdminDashboard:'+e.message);return[]}
}

function getAdminDetail(adminName){
  try{
    var ms=getSellersByAdmin(adminName);
    var md=getMemberData();
    var sp=[];
    for(var i=0;i<md.length;i++){
      var nm=String(md[i][2]||md[i][0]||'').trim();
      var rl=String(md[i][5]||'').trim();
      if(rl==='관리자'||rl==='마스터'||rl==='부마스터')continue;
      if(!ms[nm]||nm===adminName)continue;
      sp.push({name:nm,phone:String(md[i][3]||''),email:String(md[i][6]||''),
        channels:String(md[i][8]||''),avgSales:String(md[i][9]||''),
        sales:0,margin:0,orders:0});
    }
    var od=getOrderDataFast();
    if(od&&od.length>1){
      var hm=buildHeaderMap(od[0]);
      for(var i=1;i<od.length;i++){
        var sl=hStr(od[i],hm,'셀러명');
        for(var j=0;j<sp.length;j++){
          if(sp[j].name===sl){
            sp[j].orders++;
            sp[j].sales+=hNum(od[i],hm,'입금액');
            sp[j].margin+=hNum(od[i],hm,'마진');
          }
        }
      }
    }
    var sw=getSS().getSheetByName('방송일정'),sc=[];
    if(sw){
      var sd=sw.getDataRange().getValues();
      var td=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
      for(var i=1;i<sd.length;i++){
        var sl=String(sd[i][3]||'');if(!ms[sl])continue;
        var dt=sd[i][0] instanceof Date?
          Utilities.formatDate(sd[i][0],Session.getScriptTimeZone(),'yyyy-MM-dd'):
          String(sd[i][0]||'');
        if(dt>=td)sc.push({date:dt,time:sd[i][1],place:sd[i][2],
          seller:sl,status:sd[i][5]||'요청'});
      }
    }
    sc.sort(function(a,b){return a.date.localeCompare(b.date)});
    return{ok:true,sellers:sp,schedules:sc.slice(0,10)};
  }catch(e){return{ok:false}}
}
function getMySellersDashboard(adminName){
  try{
    var sellers=[];try{var res=getMySellers(adminName);sellers=(res&&res.sellers)?res.sellers:[];}catch(e2){}
    var sm={};for(var i=0;i<sellers.length;i++)sm[sellers[i].name]=true;
    var upcoming=[];
    try{
      var sw=getSS().getSheetByName('방송일정');
      if(sw&&sw.getLastRow()>1){
        var sd=sw.getDataRange().getValues(),td=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
        for(var i=1;i<sd.length;i++){
          var sl=String(sd[i][3]||'');if(!sm[sl])continue;
          var dt=sd[i][0] instanceof Date?Utilities.formatDate(sd[i][0],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(sd[i][0]||'');
          var st=String(sd[i][5]||'요청');if(st==='취소'||!dt)continue;
          if(dt>=td)upcoming.push({date:dt,time:String(sd[i][1]||''),place:String(sd[i][2]||''),seller:sl,status:st});
        }
        upcoming.sort(function(a,b){return a.date.localeCompare(b.date)});
      }
    }catch(e3){}
    try{
      var od=getOrderDataFast(); // ★ 캐시 조회
      var ss4={};
      if(od&&od.length>1){
        var hm=buildHeaderMap(od[0]);
        for(var i=1;i<od.length;i++){
          var sl=hStr(od[i],hm,'셀러명');if(!sm[sl])continue;
          if(!ss4[sl])ss4[sl]={orders:0,amount:0,margin:0,paid:0,unpaid:0,shipped:0,pending:0};
          var sv=ss4[sl];sv.orders++;sv.amount+=hNum(od[i],hm,'입금액');sv.margin+=hNum(od[i],hm,'마진');
          var ps=hStr(od[i],hm,'입금상태'),sh=hStr(od[i],hm,'출고상태');
          if(ps==='입금완료')sv.paid++;else sv.unpaid++;
          if(sh==='출고완료')sv.shipped++;else sv.pending++;
        }
      }
      for(var i=0;i<sellers.length;i++){
        sellers[i].stats=ss4[sellers[i].name]||{orders:0,amount:0,margin:0,paid:0,unpaid:0,shipped:0,pending:0};
      }
    }catch(e4){}
    return{ok:true,sellers:sellers,upcoming:upcoming.slice(0,10)};
  }catch(e){return{ok:false,msg:String(e)}}
}
    function getMySellersDashboard(adminName){
  try{
    var sellers=[];
    try{var res=getMySellers(adminName);sellers=(res&&res.sellers)?res.sellers:[];}catch(e2){}
    var sm={};
    for(var i=0;i<sellers.length;i++)sm[sellers[i].name]=true;
    var upcoming=[];
    try{
      var sw=getSS().getSheetByName('방송일정');
      if(sw&&sw.getLastRow()>1){
        var sd=sw.getDataRange().getValues();
        var td=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
        for(var i=1;i<sd.length;i++){
          var sl=String(sd[i][3]||'');if(!sm[sl])continue;
          var dt=sd[i][0] instanceof Date?Utilities.formatDate(sd[i][0],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(sd[i][0]||'');
          var st=String(sd[i][5]||'요청');if(st==='취소'||!dt)continue;
          if(dt>=td)upcoming.push({date:dt,time:String(sd[i][1]||''),place:String(sd[i][2]||''),seller:sl,status:st});
        }
        upcoming.sort(function(a,b){return a.date.localeCompare(b.date)});
      }
    }catch(e3){}
    try{
      var od=getOrderDataFast();
      var ss4={};
      if(od&&od.length>1){
        var hm=buildHeaderMap(od[0]);
        for(var i=1;i<od.length;i++){
          var sl=hStr(od[i],hm,'셀러명');if(!sm[sl])continue;
          if(!ss4[sl])ss4[sl]={orders:0,amount:0,margin:0,paid:0,unpaid:0,shipped:0,pending:0};
          var sv=ss4[sl];sv.orders++;sv.amount+=hNum(od[i],hm,'입금액');sv.margin+=hNum(od[i],hm,'마진');
          var ps=hStr(od[i],hm,'입금상태'),sh=hStr(od[i],hm,'출고상태');
          if(ps==='입금완료')sv.paid++;else sv.unpaid++;
          if(sh==='출고완료')sv.shipped++;else sv.pending++;
        }
      }
      for(var i=0;i<sellers.length;i++){
        sellers[i].stats=ss4[sellers[i].name]||{orders:0,amount:0,margin:0,paid:0,unpaid:0,shipped:0,pending:0};
      }
    }catch(e4){}
    return{ok:true,sellers:sellers,upcoming:upcoming.slice(0,10)};
  }catch(e){return{ok:false,msg:String(e)}}
}

function getSellerAnalytics(role,name){
  try{
    var isM=(role==='마스터'||role==='부마스터'),isA=(role==='관리자');
    var ms=isA?getSellersByAdmin(name):{};
    var now=new Date();
    var d7=Utilities.formatDate(new Date(now.getTime()-7*86400000),Session.getScriptTimeZone(),'yyyy-MM-dd');
    var d14=Utilities.formatDate(new Date(now.getTime()-14*86400000),Session.getScriptTimeZone(),'yyyy-MM-dd');
    var sellers={};
    var od=getOrderDataFast(); // ★ 캐시 조회
    if(od&&od.length>1){
      var hm=buildHeaderMap(od[0]);
      for(var i=1;i<od.length;i++){
        var row=od[i],sel=hStr(row,hm,'셀러명');if(!sel)continue;
        if(!isM){if(isA){if(!ms[sel])continue}else{if(sel!==name)continue}}
        if(!sellers[sel])sellers[sel]={name:sel,total:0,margin:0,orders:0,qty:0,phones:{},w1:0,w2:0,m1:0,lastDate:'',products:{}};
        var s=sellers[sel],dt=hDate(row,hm,'날짜'),amt=hNum(row,hm,'입금액'),mrg=hNum(row,hm,'마진');
        s.total+=amt;s.margin+=mrg;s.orders++;s.qty+=hNum(row,hm,'수량');
        var ph=hStr(row,hm,'연락처')||hStr(row,hm,'수령자');if(ph)s.phones[ph]=true;
        var pr=hStr(row,hm,'상품명');if(pr)s.products[pr]=true;
        if(dt>s.lastDate)s.lastDate=dt;
        if(dt>=d7)s.w1+=amt;if(dt>=d14&&dt<d7)s.w2+=amt;s.m1+=amt;
      }
    }
    var schedWs=getSS().getSheetByName('방송일정'),bcasts={};
    if(schedWs&&schedWs.getLastRow()>1){
      var sd=schedWs.getDataRange().getValues();
      for(var i=1;i<sd.length;i++){
        var sel=String(sd[i][3]||'');if(!sellers[sel]||String(sd[i][5]||'')==='취소')continue;
        if(!bcasts[sel])bcasts[sel]={count:0,lastBc:''};bcasts[sel].count++;
        var dt2=sd[i][0] instanceof Date?Utilities.formatDate(sd[i][0],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(sd[i][0]||'');
        if(dt2>bcasts[sel].lastBc)bcasts[sel].lastBc=dt2;
      }
    }
    var list=[];
    for(var k in sellers){
      if(!sellers.hasOwnProperty(k))continue;
      var s=sellers[k],bc=bcasts[k]||{count:0,lastBc:''};
      var ao=s.orders>0?Math.round(s.total/s.orders):0;
      var gw=s.w2>0?Math.round((s.w1-s.w2)/s.w2*100):(s.w1>0?100:0);
      var rt=s.total>0?Math.round(s.margin/s.total*100):0;
      var ds=s.lastDate?Math.ceil((now-new Date(s.lastDate+'T00:00:00'))/86400000):999;
      var st='활성';if(ds>14)st='비활성';if(gw>=30)st='성장중';if(gw<=-30)st='하락중';
      if(s.total>=1000000&&rt>=30)st='핵심셀러';
      list.push({name:k,total:s.total,margin:s.margin,orders:s.orders,rate:rt,avgOrder:ao,
        buyerCount:Object.keys(s.phones).length,productCount:Object.keys(s.products).length,
        qty:s.qty,w1:s.w1,growthW:gw,m1:s.m1,bcCount:bc.count,lastBc:bc.lastBc,
        lastOrder:s.lastDate,daysSince:ds,status:st});
    }
    list.sort(function(a,b){return b.total-a.total});
    return{ok:true,sellers:list};
  }catch(e){return{ok:false,sellers:[]}}
}

// ════════════════════════════════════════════════════════════
// 회원 관련
// ════════════════════════════════════════════════════════════

function doRegister(d){
  try{
    var ss=getSS(),sheet=ss.getSheetByName('MEMBER');if(!sheet)return{ok:false,msg:'MEMBER 탭 없음'};
    var data=getMemberData(); // ★ 캐시 조회로 중복 확인
    for(var i=0;i<data.length;i++){if(String(data[i][0]).trim()===String(d.id).trim())return{ok:false,msg:'이미 존재하는 아이디'}}
    sheet.appendRow([d.id,d.pw,d.name,d.phone,Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm'),'승인대기',d.email||'','셀러','','',d.adminId||'']);
    invalidateMemberCache(); // ★ 회원 추가 후 캐시 초기화
    return{ok:true,msg:'가입 신청 완료! 관리자 승인 후 이용 가능합니다'};
  }catch(e){return{ok:false,msg:e.message}}
}

function updateSellerProfile(userId,channels,avgSales){
  try{
    var ss=getSS(),ws=ss.getSheetByName('MEMBER');if(!ws)return{ok:false};
    var d=ws.getDataRange().getValues();
    for(var i=1;i<d.length;i++){
      if(String(d[i][0]).trim()===userId){
        ws.getRange(i+1,9).setValue(channels);ws.getRange(i+1,10).setValue(avgSales);
        invalidateMemberCache(); // ★ 수정 후 캐시 초기화
        return{ok:true};
      }
    }
    return{ok:false};
  }catch(e){return{ok:false}}
}

function getAdminList(){
  try{
    var data=getMemberData(),list=[]; // ★ 캐시 조회
    for(var i=0;i<data.length;i++){
      var st=String(data[i][5]||'').trim();
      if(st==='관리자'||st==='마스터'||st==='부마스터')list.push({id:data[i][0],name:data[i][2]||data[i][0],company:''});
    }
    return list;
  }catch(e){return[]}
}

function setupMemberDropdown(){
  try{
    var ss=getSS(),ws=ss.getSheetByName('MEMBER');if(!ws)return{ok:false};
    ws.getRange(2,6,500,1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['마스터','부마스터','관리자','셀러','가입(로그인 차단)']).build());
    return{ok:true};
  }catch(e){return{ok:false,msg:e.message}}
}

// ════════════════════════════════════════════════════════════
// 상품/재고
// ════════════════════════════════════════════════════════════

function normBarcode(v){
  var s=String(v||'').trim().replace(/\.0+$/,'').replace(/\s/g,'');
  if(s&&!isNaN(s)){try{s=BigInt?String(BigInt(s)):String(parseInt(s))}catch(e){s=String(Number(s))}}
  return s;
}

function getProductList(){
  try{var cache=CacheService.getScriptCache(),cached=cache.get('productList_v1');if(cached)return JSON.parse(cached);}catch(ce){}
  var ss=getSS(),tabs=CONFIG.WMS_TABS||[],pMap={};
  for(var t=0;t<tabs.length;t++){
    try{
      var ws=ss.getSheetByName(tabs[t].name);if(!ws)continue;
      var d=ws.getDataRange().getValues();
      var bcI=tabs[t].bcCol-1,stI=tabs[t].stCol-1;
      var nmI=(tabs[t].nameCol||0)-1,spI=(tabs[t].supplyCol||0)-1,slI=(tabs[t].sellCol||0)-1;
      for(var i=1;i<d.length;i++){
        var bc=normBarcode(d[i][bcI]);if(!bc||bc==='0'||bc==='')continue;
        var qty=Number(d[i][stI])||0;
        if(!pMap[bc]){
          pMap[bc]={code:(tabs[t].codeCol&&tabs[t].codeCol>0?String(d[i][tabs[t].codeCol-1]||'').trim():''),
            name:nmI>=0?(d[i][nmI]||''):'',barcode:bc,
            supplyPrice:spI>=0?Number(d[i][spI])||0:0,
            sellPrice:slI>=0?Number(d[i][slI])||0:0,
            stockMujin:0,stock1:0,stock2:0,stock3:0,totalStock:0};
        }
        if(!pMap[bc].name&&nmI>=0&&d[i][nmI])pMap[bc].name=d[i][nmI];
        if(!pMap[bc].sellPrice&&slI>=0&&d[i][slI])pMap[bc].sellPrice=Number(d[i][slI])||0;
        if(!pMap[bc].supplyPrice&&spI>=0&&d[i][spI])pMap[bc].supplyPrice=Number(d[i][spI])||0;
        if(t===0)pMap[bc].stockMujin+=qty;
        else if(t===1)pMap[bc].stock1+=qty;
        else if(t===2)pMap[bc].stock2+=qty;
        else if(t===3)pMap[bc].stock3+=qty;
        pMap[bc].totalStock+=qty;
      }
    }catch(e){continue}
  }
  var list=[];for(var bc in pMap){if(pMap.hasOwnProperty(bc))list.push(pMap[bc]);}
  try{if(list.length>0)CacheService.getScriptCache().put('productList_v1',JSON.stringify(list),60);}catch(ce){}
  return list;
}

function findByBarcode(bc){var ps=getProductList(),b=normBarcode(bc);for(var i=0;i<ps.length;i++){if(normBarcode(ps[i].barcode)===b)return ps[i]}return null;}
function findByCode(c){var ps=getProductList(),cd=String(c).trim();for(var i=0;i<ps.length;i++){if(String(ps[i].code)===cd)return ps[i]}return null;}

function getSellerStats(sn){
  try{
    var od=getOrderDataFast(),orders=0,revenue=0,pMap={}; // ★ 캐시 조회
    if(od&&od.length>1){
      var hm=buildHeaderMap(od[0]);
      for(var i=1;i<od.length;i++){
        if(hStr(od[i],hm,'셀러명')===sn){
          orders++;revenue+=hNum(od[i],hm,'입금액');
          var nm=hStr(od[i],hm,'상품명');
          if(!pMap[nm])pMap[nm]={name:nm,qty:0,revenue:0};
          pMap[nm].qty+=hNum(od[i],hm,'수량');pMap[nm].revenue+=hNum(od[i],hm,'입금액');
        }
      }
    }
    var top=[];for(var k in pMap)top.push(pMap[k]);
    top.sort(function(a,b){return b.revenue-a.revenue});
    return{orders:orders,revenue:revenue,topProducts:top.slice(0,5)};
  }catch(e){return{orders:0,revenue:0,topProducts:[]}}
}

// ════════════════════════════════════════════════════════════
// 방송 관련
// ════════════════════════════════════════════════════════════

var PLATFORMS=[
  {id:'grip',name:'그립',color:'#FF2D55'},{id:'kulme',name:'쿠팡라이브',color:'#5B5FEE'},
  {id:'youtube',name:'유튜브',color:'#FF0000'},{id:'tiktok',name:'틱톡',color:'#111111'},
  {id:'band',name:'밴드',color:'#06C755'},{id:'etc',name:'기타',color:'#888888'}
];

function startBroadcast(data){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_BROADCASTS);
    if(!ws)ws=ss.insertSheet(CONFIG.TAB_BROADCASTS);
    var bcCode='BC-'+Utilities.formatDate(new Date(),'Asia/Seoul','MMdd')+'-'+Math.floor(Math.random()*900+100);
    ws.appendRow([bcCode,data.code||'',data.seller||'','',data.platform||'',
      Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm'),'','','',data.memo||'']);
    return bcCode;
  }catch(e){throw e}
}

function endBroadcast(bcCode){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_BROADCASTS);if(!ws)return;
    var d=ws.getDataRange().getValues();
    for(var i=1;i<d.length;i++){
      if(String(d[i][0])===bcCode){ws.getRange(i+1,7).setValue(Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm'));break;}
    }
  }catch(e){}
}

function getRecentBroadcasts(sellerName){
  try{
    var ss=getSS(),ws=ss.getSheetByName(CONFIG.TAB_BROADCASTS);if(!ws||ws.getLastRow()<2)return[];
    var d=ws.getDataRange().getValues(),list=[];
    for(var i=d.length-1;i>=1;i--){
      if(!sellerName||String(d[i][2])===sellerName||String(d[i][1])===sellerName){
        list.push({code:d[i][0],seller:d[i][2],platform:d[i][4],startTime:d[i][5],revenue:d[i][8]||0});
        if(list.length>=10)break;
      }
    }
    return list;
  }catch(e){return[]}
}

function addBroadcastSchedule(date,place,time,memo,seller,role){
  try{
    var ss=getSS(),ws=ss.getSheetByName('방송일정');
    if(!ws){ws=ss.insertSheet('방송일정');ws.getRange(1,1,1,7).setValues([['날짜','시간','장소','셀러','메모','상태','요청일시']]).setFontWeight('bold');}
    var now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm');
    var status=(role==='마스터'||role==='부마스터'||role==='관리자')?'확정':'요청';
    ws.getRange(ws.getLastRow()+1,1,1,7).setValues([[date,time,place,seller,memo,status,now]]);
    return{ok:true};
  }catch(e){return{ok:false,msg:e.message}}
}

function getMonthSchedules(ym,role,name){
  try{
    var ss=getSS(),ws=ss.getSheetByName('방송일정');if(!ws)return[];
    var d=ws.getDataRange().getValues();
    var isA=(role==='관리자'),isM=(role==='마스터'||role==='부마스터');
    var ms=isA?getSellersByAdmin(name):{},list=[];
    for(var i=1;i<d.length;i++){
      var dt=d[i][0] instanceof Date?Utilities.formatDate(d[i][0],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(d[i][0]||'');
      if(!dt.startsWith(ym))continue;
      var sel=String(d[i][3]||''),st=String(d[i][5]||'요청');if(st==='취소')continue;
      if(!isM){if(isA){if(!ms[sel])continue}else{if(sel!==name)continue}}
      list.push({row:i+1,date:dt,time:d[i][1],place:d[i][2],seller:sel,memo:d[i][4],status:st});
    }
    return list;
  }catch(e){return[]}
}
function confirmBroadcastSchedule(row){try{getSS().getSheetByName('방송일정').getRange(row,6).setValue('확정');return{ok:true};}catch(e){return{ok:false,msg:e.message}}}
function cancelBroadcastSchedule(row){try{getSS().getSheetByName('방송일정').getRange(row,6).setValue('취소');return{ok:true};}catch(e){return{ok:false,msg:e.message}}}
function changeBroadcastSchedule(row,nd,nt){try{var ws=getSS().getSheetByName('방송일정');ws.getRange(row,1).setValue(nd);ws.getRange(row,2).setValue(nt);return{ok:true};}catch(e){return{ok:false,msg:e.message}}}
function changeBroadcastDate(row,nd){try{getSS().getSheetByName('방송일정').getRange(row,1).setValue(nd);return{ok:true};}catch(e){return{ok:false,msg:e.message}}}

// ════════════════════════════════════════════════════════════
// AI / 네이버
// ════════════════════════════════════════════════════════════

function getAISalesPoints(barcode,name,sale,supply){
  try{
    var cache=CacheService.getScriptCache(),cached=cache.get('ai6_'+barcode);
    if(cached)return{ok:true,data:JSON.parse(cached)};
    var margin=sale>0?Math.round((sale-supply)/sale*100):0;
    var prompt='역할: 라이브커머스 전문가\n제품명: '+name+'\n판매가: '+Number(sale).toLocaleString()+'원\n마진율: '+margin+'%\n\n반드시 JSON만 출력:\n{"headline":"캐치프레이즈","what_is":"핵심 설명","why_good":["효능1","효능2","효능3"],"who_needs":["대상1","대상2"],"how_to_use":"사용법","synergy":"시너지","talk_points":["멘트1","멘트2","멘트3"],"price_talk":"가격어필"}';
    if(CONFIG.OPENAI_KEY){try{var r=callOpenAI(prompt);if(r){cache.put('ai6_'+barcode,JSON.stringify(r),3600);return{ok:true,data:r}}}catch(e){}}
    if(CONFIG.GEMINI_KEY){try{var r2=callGemini(prompt);if(r2){cache.put('ai6_'+barcode,JSON.stringify(r2),3600);return{ok:true,data:r2}}}catch(e){}}
    return buildLocalAnalysis(name,sale,supply);
  }catch(e){return buildLocalAnalysis(name,sale,supply)}
}

function callOpenAI(prompt){
  var res=UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions',{
    method:'post',contentType:'application/json',
    headers:{'Authorization':'Bearer '+CONFIG.OPENAI_KEY},
    payload:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'user',content:prompt}],temperature:0.7,max_tokens:1024}),
    muteHttpExceptions:true
  });
  if(res.getResponseCode()!==200)return null;
  var text=JSON.parse(res.getContentText()).choices[0].message.content;
  text=text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
  var js=text.indexOf('{'),je=text.lastIndexOf('}');if(js>=0&&je>js)text=text.substring(js,je+1);
  return JSON.parse(text);
}

function callGemini(prompt){
  var res=UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+CONFIG.GEMINI_KEY,
    {method:'post',contentType:'application/json',payload:JSON.stringify({contents:[{parts:[{text:prompt}]}]}),muteHttpExceptions:true});
  if(res.getResponseCode()!==200)return null;
  var body=JSON.parse(res.getContentText());if(!body.candidates||!body.candidates[0])return null;
  var text=body.candidates[0].content.parts[0].text;
  text=text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
  var js=text.indexOf('{'),je=text.lastIndexOf('}');if(js>=0&&je>js)text=text.substring(js,je+1);
  return JSON.parse(text);
}

function buildLocalAnalysis(name,sale,supply){
  var mg=sale>0?Math.round((sale-supply)/sale*100):0,pf=sale-supply;
  var d={headline:'',what_is:'',why_good:[],who_needs:[],how_to_use:'',synergy:'',talk_points:[],price_talk:''};
  if(mg>=40){d.headline='마진 '+mg+'%! 고수익 추천';d.price_talk='개당 '+Number(pf).toLocaleString()+'원 수익!';}
  else if(mg>=25){d.headline='마진 '+mg+'% 안정 수익';d.price_talk='마진 '+mg+'% 안정적 수익';}
  else{d.headline='빠른 회전율 상품';d.price_talk='대량 판매로 수익 극대화';}
  d.what_is=(name||'')+'입니다. 품질이 검증된 제품입니다.';
  d.why_good=['검증된 품질','높은 재구매율','합리적 가격'];
  d.who_needs=['건강 관리에 관심 있는 분','가성비를 중시하는 분','선물용'];
  d.how_to_use='제품 설명에 따라 사용하세요';d.synergy='관련 제품과 함께 사용 추천';
  d.talk_points=['지금 이 가격에 이 품질!','시중가보다 훨씬 저렴!','오늘 주문하시면 바로 출고!'];
  return{ok:true,data:d};
}

function searchNaverShopping(query){
  var url='https://search.shopping.naver.com/search/all?query='+encodeURIComponent(query);
  if(!CONFIG.NAVER_CLIENT_ID)return{ok:false,url:url,items:[]};
  try{
    var res=UrlFetchApp.fetch('https://openapi.naver.com/v1/search/shop.json?query='+encodeURIComponent(query)+'&display=6',
      {headers:{'X-Naver-Client-Id':CONFIG.NAVER_CLIENT_ID,'X-Naver-Client-Secret':CONFIG.NAVER_CLIENT_SECRET},muteHttpExceptions:true});
    var items=(JSON.parse(res.getContentText()).items||[]).map(function(it){
      return{title:it.title.replace(/<[^>]*>/g,''),price:it.lprice,image:it.image,mall:it.mallName};
    });
    return{ok:true,url:url,items:items};
  }catch(e){return{ok:false,url:url,items:[]}}
}

// ════════════════════════════════════════════════════════════
// 제안서 / 초기설정 / 유틸
// ════════════════════════════════════════════════════════════

function initialSetup(){
  var ss=getSS();
  [{name:CONFIG.TAB_ORDERS,h:ORDER_COLS},
   {name:CONFIG.TAB_BROADCASTS,h:['방송ID','방송명','셀러ID','셀러명','플랫폼','시작시간','종료시간','스캔수','소개상품수','메모']},
   {name:CONFIG.TAB_PROPOSALS,h:['제출일','업체명','담당자','연락처','이메일','제품명','카테고리','설명','파일링크','AI분석','분석점수','상태']}
  ].forEach(function(t){
    if(!ss.getSheetByName(t.name)){
      var s=ss.insertSheet(t.name);s.appendRow(t.h);
      s.getRange('1:1').setFontWeight('bold').setBackground('#1e293b').setFontColor('#fff');
    }
  });
  return'완료';
}

function submitProposal(data){
  try{
    var ss=getSS(),s=ss.getSheetByName(CONFIG.TAB_PROPOSALS);
    if(!s){initialSetup();s=ss.getSheetByName(CONFIG.TAB_PROPOSALS);}
    s.appendRow([Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm'),
      data.company,data.manager,data.phone,data.email,data.productName,
      data.category,data.description,data.fileUrl||'','','','대기']);
    return{ok:true,msg:'제안서 접수 완료'};
  }catch(e){return{ok:false,msg:e.message}}
}

function getProposals(){
  try{
    var ss=getSS(),s=ss.getSheetByName(CONFIG.TAB_PROPOSALS);
    if(!s||s.getLastRow()<2)return{ok:true,proposals:[]};
    var d=s.getDataRange().getValues(),list=[];
    for(var i=d.length-1;i>=1;i--){
      list.push({date:d[i][0],company:d[i][1],manager:d[i][2],phone:d[i][3],email:d[i][4],
        productName:d[i][5],category:d[i][6],description:d[i][7],fileUrl:d[i][8],status:d[i][11]});
    }
    return{ok:true,proposals:list};
  }catch(e){return{ok:true,proposals:[]}}
}

function fmt(n){return Number(n||0).toLocaleString('ko-KR')}

function formatDateKorean(dateStr){
  try{
    var d=new Date(dateStr);
    var month=d.getMonth()+1;
    var day=d.getDate();
    var hour=d.getHours();
    var min=d.getMinutes();
    return month+'월 '+day+'일 '+hour+'시 '+(min<10?'0'+min:min)+'분 발주';
  }catch(e){return dateStr||''}
}// ============================================
// Google Apps Script 라이브커머스 시스템 v2.5
// ============================================
//
// 여기에 전체 Apps Script 코드를 붙여넣으세요
//
// 저장 방법:
// 1. Apps Script 에디터 열기
// 2. 전체 코드 복사 (Cmd+A, Cmd+C)
// 3. 이 파일에 붙여넣기 (Cmd+V)
// 4. 저장 (Cmd+S)
//
// 저장 완료 후 "코드 저장 완료" 라고 말씀해주세요.
//
