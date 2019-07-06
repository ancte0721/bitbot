

const fs = require("fs");
const request = require('request');
const crypto = require('crypto');
const channelName = "lightning_ticker_FX_BTC_JPY";

const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf8'));


// 注文一覧
function getMyOrder(nowPrice, func) {
  let timestamp = Date.now().toString();
  let method = 'GET';
  let path = '/v1/me/getchildorders?product_code=FX_BTC_JPY&child_order_state=ACTIVE';
  let text = timestamp + method + path;
  let sign = crypto.createHmac('sha256', CONFIG['SECRET-KEY']).update(text).digest('hex');
  let options = {
      url: 'https://api.bitflyer.com' + path,
      method: method,
      headers: {
          'ACCESS-KEY': CONFIG['ACCESS-KEY'],
          'ACCESS-TIMESTAMP': timestamp,
          'ACCESS-SIGN': sign,
          'Content-Type': 'application/json'
      }
  };
  request(options, function (err, response, payload) {
      // console.log(payload);
      func(JSON.parse(payload), nowPrice);
  });
}

// 建玉一覧
function getPositions() {
  let timestamp = Date.now().toString();
  let method = 'GET';
  let path = '/v1/me/getpositions?product_code=FX_BTC_JPY';
  let text = timestamp + method + path;
  let sign = crypto.createHmac('sha256', CONFIG['SECRET-KEY']).update(text).digest('hex');
  let options = {
      url: 'https://api.bitflyer.com' + path,
      method: method,
      headers: {
          'ACCESS-KEY': CONFIG['ACCESS-KEY'],
          'ACCESS-TIMESTAMP': timestamp,
          'ACCESS-SIGN': sign,
          'Content-Type': 'application/json'
      }
  };
  request(options, function (err, response, payload) {
      console.log(JSON.parse(payload));
  });
}

// キャンセル
function orderCancel(orderid) {
  let timestamp = Date.now().toString();
  let method = 'POST';
  let path = '/v1/me/cancelchildorder';
  let body = JSON.stringify({
      product_code: 'FX_BTC_JPY',
      child_order_id: orderid
  });
  let text = timestamp + method + path + body;
  let sign = crypto.createHmac('sha256', CONFIG['SECRET-KEY']).update(text).digest('hex');
  let options = {
      url: 'https://api.bitflyer.com' + path,
      method: method,
      body: body,
      headers: {
          'ACCESS-KEY': CONFIG['ACCESS-KEY'],
          'ACCESS-TIMESTAMP': timestamp,
          'ACCESS-SIGN': sign,
          'Content-Type': 'application/json'
      }
  };
  request(options, function (err, response, payload) {
  });
}


getMyOrder(1200000, function(p, nowPrice){
  p.forEach(function(item) {
     // 5000円以上離れていたら
     if(Math.abs(item['price'] - nowPrice) > 5000){
       console.log(item['child_order_id'], item['side'], item['outstanding_size']);
       orderCancel(item['child_order_id']);
       // 逆取引
       buyBTC(item['outstanding_size'], 1200000, (item['side'] == 'BUY') ? 'SELL':'BUY', 'MARKET', {commet:'損切'});
     }
  });
});

console.log(('BUY' == 'BUYa')?'ok':'NG');

//console.log(CONFIG['ACCESS-KEY']);
