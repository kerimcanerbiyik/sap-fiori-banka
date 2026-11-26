namespace banka.db;

entity Hesaplar {
  key ID         : UUID;
      hesapNo    : String(20);
      sahipAdi   : String(100);
      bakiye     : Decimal(15,2);
      krediBorcu : Decimal(15,2) default 0;
      paraBirimi : String(3) default 'TRY';
}

entity Islemler {
  key ID         : UUID;
      islemTipi  : String(20);
      gonderenNo : String(20);
      aliciNo    : String(20);
      tutar      : Decimal(15,2);
      aciklama   : String(250);
      tarih      : Timestamp @cds.on.insert : $now;
}

entity Piyasa {
  key sembol     : String(10);
      ad         : String(50);
      fiyat      : Decimal(15,2);
      degisim    : Decimal(5,2);
}

entity Portfoy {
  key ID         : UUID;
      hesapNo    : String(20);
      sembol     : String(10);
      adet       : Decimal(15,4);
}
