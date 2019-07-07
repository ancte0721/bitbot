// BitBot
const io = require('socket.io-client');
const sta = require("simple-statistics");
const fs = require("fs");
const request = require('request');
const crypto = require('crypto');
const socket = io("https://io.lightstream.bitflyer.com", { transports: ["websocket"] });
const channelName = "lightning_ticker_FX_BTC_JPY";
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const FILENAME = CONFIG['PRICE-LOG']
const BUYSELLFILE = CONFIG['ORDER-LOG']


// ソケットで価格情報取得
socket.on("connect", () => {
    socket.emit("subscribe", channelName);
});
socket.on(channelName, message => {
    let dd = new Date(message.timestamp);
    // console.log(dd.toLocaleString(), message);
    printPrice(dd.toLocaleString(), message.ltp);
});


var count = 0;
var lastBUY = 0;
var ringbuffer = [0,0,0,0,0];

function printPrice (time, price) {
  // console.log(count%ringbuffer.length, time, price);
  ringbuffer[count%ringbuffer.length] = price;
  let json = {
    time: time,
    price: price,
    mean: parseInt(sta.mean(ringbuffer)),
    min: parseInt(sta.min(ringbuffer)),
    max: parseInt(sta.max(ringbuffer)),
    // v: parseInt(sta.variance(ringbuffer)),
    sd: parseInt(sta.standardDeviation(ringbuffer))
  }
  // console.log(json);
  console.log(json.time+','+json.price+','+json.mean+','+json.min+','+json.max+','+json.sd);
  appendFile(FILENAME, json.time+','+json.price+','+json.mean+','+json.min+','+json.max+','+json.sd+'\n');
  count+=1;

　// 価格変動時に注文
  if(json.sd > 800 && count>30 && (count - lastBUY) > 30){
    buyBTC(CONFIG['AMOUNT'], json.mean + 700, 'SELL', 'LIMIT', json);
    buyBTC(CONFIG['AMOUNT'], json.mean - 700, 'BUY', 'LIMIT',json);
    lastBUY = count
    getMyBalance();
  }

  // 損切ロジック
  if(count%60 ==0){
    getMyOrder(price, function(p, nowPrice){
      p.forEach(function(item) {
         // 5000円以上離れていたら
         if(Math.abs(item['price'] - nowPrice) > 5000){
           console.log(item['child_order_id'], item['side'], item['outstanding_size']);
           orderCancel(item['child_order_id']);
           // 逆取引
           buyBTC(item['outstanding_size'], 0, (item['side'] == 'BUY') ? 'BUY':'SELL', 'MARKET', {commet:'損切', time:Date.now().toLocaleString()});
         }
      });
    });
  }

}

// ファイル出力
function appendFile(path, data) {
  fs.appendFile(path, data, function (err) {
    if (err) {
        throw err;
    }
  });
}

// 売り買い
function buyBTC(mount, price, buysell, order_type, tickdata) {
  let timestamp = Date.now().toString();
  let method = 'POST';
  let path = '/v1/me/sendchildorder';
  let body = JSON.stringify({
      product_code: 'FX_BTC_JPY',
      child_order_type: order_type,
      side: buysell,
      price: price,
      size: mount
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
  appendFile(BUYSELLFILE, JSON.stringify(tickdata) + ',' + body + '\n');

  request(options, function (err, response, payload) {
      console.log(payload);
      appendFile(BUYSELLFILE, payload + '\n');
  });
}

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

// 証拠金情報
function getMyBalance() {
  let timestamp = Date.now().toString();
  let method = 'GET';
  let path = '/v1/me/getcollateral';
  let body = JSON.stringify({});
  let text = timestamp + method + path;
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
      console.log(payload);
      appendFile(BUYSELLFILE, payload + '\n');
  });
}


appendFile(FILENAME, 'time,price,mean,min,max,sd\n');
