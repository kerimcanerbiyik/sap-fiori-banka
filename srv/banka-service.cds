using { banka.db as db } from '../db/schema';

service BankaService @(path: '/odata/v4/banka') {
  entity Hesaplar as projection on db.Hesaplar;
  entity Islemler as projection on db.Islemler;
  entity Piyasa   as projection on db.Piyasa;
  entity Portfoy  as projection on db.Portfoy;

  action paraTransferi(gonderenNo: String, aliciNo: String, tutar: Decimal, aciklama: String) returns String;
  action krediCek(hesapNo: String, tutar: Decimal) returns String;
  action krediOde(hesapNo: String, tutar: Decimal) returns String;
  action gunlukFaiz(hesapNo: String) returns String;
  action yeniHesapAc(hesapNo: String, sahipAdi: String, baslangicBakiye: Decimal) returns String;
  action piyasaGuncelle() returns String;
  action varlikAl(hesapNo: String, sembol: String, adet: Decimal) returns String;
  action varlikSat(hesapNo: String, sembol: String, adet: Decimal) returns String;
  action faturaOde(hesapNo: String, kurum: String, tutar: Decimal) returns String;
  action sansCarki(hesapNo: String) returns String;
}
