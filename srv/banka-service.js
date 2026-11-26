const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { Hesaplar, Islemler, Piyasa, Portfoy } = this.entities;

  this.on('paraTransferi', async (req) => {
    const { gonderenNo, aliciNo, tutar, aciklama } = req.data;
    const miktar = Number(tutar);
    if (!miktar || miktar <= 0) return req.error(400, 'Gecerli bir tutar giriniz.');
    if (gonderenNo === aliciNo) return req.error(400, 'Kendi hesabiniza transfer yapamazsiniz.');

    const gonderen = await SELECT.one.from(Hesaplar).where({ hesapNo: gonderenNo });
    const alici = await SELECT.one.from(Hesaplar).where({ hesapNo: aliciNo });

    if (!gonderen) return req.error(404, 'Gonderen hesap bulunamadi.');
    if (!alici) return req.error(404, 'Alici hesap bulunamadi! (Orn: TR00 5678 veya TR00 9999)');
    if (Number(gonderen.bakiye) < miktar) return req.error(400, 'Yetersiz bakiye!');

    await UPDATE(Hesaplar).set({ bakiye: Number(gonderen.bakiye) - miktar }).where({ hesapNo: gonderenNo });
    await UPDATE(Hesaplar).set({ bakiye: Number(alici.bakiye) + miktar }).where({ hesapNo: aliciNo });

    await INSERT.into(Islemler).entries({
      islemTipi: 'TRANSFER',
      gonderenNo,
      aliciNo,
      tutar: miktar,
      aciklama: aciklama || 'EFT / Havale Transferi'
    });

    return `${miktar} TRY basariyla ${alici.sahipAdi} (${aliciNo}) hesabina gonderildi.`;
  });

  this.on('krediCek', async (req) => {
    const { hesapNo, tutar } = req.data;
    const miktar = Number(tutar);
    const hesap = await SELECT.one.from(Hesaplar).where({ hesapNo });
    if (!hesap) return req.error(404, 'Hesap bulunamadi.');

    const faizliBorc = Number((miktar * 1.15).toFixed(2));
    await UPDATE(Hesaplar).set({
      bakiye: Number(hesap.bakiye) + miktar,
      krediBorcu: Number(hesap.krediBorcu) + faizliBorc
    }).where({ hesapNo });

    await INSERT.into(Islemler).entries({
      islemTipi: 'KREDI',
      gonderenNo: 'FIORIBANK KREDI',
      aliciNo: hesapNo,
      tutar: miktar,
      aciklama: `Aninda Kredi (%15 faizli geri odeme: ${faizliBorc} TRY)`
    });

    return `${miktar} TRY kredi hesabiniza aktarildi.`;
  });

  this.on('krediOde', async (req) => {
    const { hesapNo, tutar } = req.data;
    const hesap = await SELECT.one.from(Hesaplar).where({ hesapNo });
    if (!hesap) return req.error(404, 'Hesap bulunamadi.');

    const mevcutBorc = Number(hesap.krediBorcu);
    if (mevcutBorc <= 0) return req.error(400, 'Odenmesi gereken kredi borcunuz yok.');

    const odenecek = Math.min(Number(tutar) || mevcutBorc, mevcutBorc);
    if (Number(hesap.bakiye) < odenecek) return req.error(400, 'Borc odemek icin bakiyeniz yetersiz.');

    await UPDATE(Hesaplar).set({
      bakiye: Number((Number(hesap.bakiye) - odenecek).toFixed(2)),
      krediBorcu: Number((mevcutBorc - odenecek).toFixed(2))
    }).where({ hesapNo });

    await INSERT.into(Islemler).entries({
      islemTipi: 'KREDI ODEME',
      gonderenNo: hesapNo,
      aliciNo: 'FIORIBANK KREDI',
      tutar: odenecek,
      aciklama: 'Kredi Borcu Odemesi'
    });

    return `${odenecek} TRY kredi borcu odendi.`;
  });

  this.on('gunlukFaiz', async (req) => {
    const { hesapNo } = req.data;
    const hesap = await SELECT.one.from(Hesaplar).where({ hesapNo });
    if (!hesap) return req.error(404, 'Hesap bulunamadi.');

    const getiri = Number((Number(hesap.bakiye) * 0.05).toFixed(2));
    if (getiri <= 0) return req.error(400, 'Faiz isletmek icin bakiyeniz pozitif olmali.');

    await UPDATE(Hesaplar).set({
      bakiye: Number((Number(hesap.bakiye) + getiri).toFixed(2))
    }).where({ hesapNo });

    await INSERT.into(Islemler).entries({
      islemTipi: 'FAIZ',
      gonderenNo: 'GUNLUK GETIRI',
      aliciNo: hesapNo,
      tutar: getiri,
      aciklama: '%5 Gunluk Mevduat Getirisi'
    });

    return `Tebrikler! ${getiri} TRY gunluk faiz hesabiniza eklendi.`;
  });

  this.on('yeniHesapAc', async (req) => {
    const { hesapNo, sahipAdi, baslangicBakiye } = req.data;
    if (!hesapNo || !sahipAdi) return req.error(400, 'Hesap No ve Sahip Adi zorunludur.');

    const varMi = await SELECT.one.from(Hesaplar).where({ hesapNo });
    if (varMi) return req.error(400, 'Bu hesap numarasi zaten mevcut!');

    const bakiye = Number(baslangicBakiye) || 10000;
    await INSERT.into(Hesaplar).entries({
      hesapNo,
      sahipAdi,
      bakiye,
      krediBorcu: 0,
      paraBirimi: 'TRY'
    });

    await INSERT.into(Islemler).entries({
      islemTipi: 'ACILIS',
      gonderenNo: 'FIORIBANK',
      aliciNo: hesapNo,
      tutar: bakiye,
      aciklama: `Yeni Hesap Acilisi (${sahipAdi})`
    });

    return `${sahipAdi} (${hesapNo}) hesabi ${bakiye} TRY ile acildi!`;
  });

  this.on('piyasaGuncelle', async () => {
    const varliklar = await SELECT.from(Piyasa);
    for (const v of varliklar) {
      const oran = (Math.random() * 0.30) - 0.14; // -%14 ile +%16 arasi dalgalanma
      const yeniFiyat = Math.max(10, Number((Number(v.fiyat) * (1 + oran)).toFixed(2)));
      const degisimYuzde = Number((oran * 100).toFixed(2));
      await UPDATE(Piyasa).set({ fiyat: yeniFiyat, degisim: degisimYuzde }).where({ sembol: v.sembol });
    }
    return 'Piyasa fiyatlari guncellendi!';
  });

  this.on('varlikAl', async (req) => {
    const { hesapNo, sembol, adet } = req.data;
    const miktar = Number(adet);
    if (!miktar || miktar <= 0) return req.error(400, 'Gecerli adet giriniz.');

    const hesap = await SELECT.one.from(Hesaplar).where({ hesapNo });
    const varlik = await SELECT.one.from(Piyasa).where({ sembol });
    if (!hesap || !varlik) return req.error(404, 'Hesap veya varlik bulunamadi.');

    const toplamTutar = Number((Number(varlik.fiyat) * miktar).toFixed(2));
    if (Number(hesap.bakiye) < toplamTutar) return req.error(400, `Yetersiz bakiye! Gereken: ${toplamTutar} TRY`);

    await UPDATE(Hesaplar).set({ bakiye: Number((Number(hesap.bakiye) - toplamTutar).toFixed(2)) }).where({ hesapNo });

    const mevcutPortfoy = await SELECT.one.from(Portfoy).where({ hesapNo, sembol });
    if (mevcutPortfoy) {
      await UPDATE(Portfoy).set({ adet: Number(mevcutPortfoy.adet) + miktar }).where({ ID: mevcutPortfoy.ID });
    } else {
      await INSERT.into(Portfoy).entries({ hesapNo, sembol, adet: miktar });
    }

    await INSERT.into(Islemler).entries({
      islemTipi: 'BORSA ALIM',
      gonderenNo: hesapNo,
      aliciNo: sembol,
      tutar: toplamTutar,
      aciklama: `${miktar} adet ${varlik.ad} alimi`
    });

    return `${miktar} adet ${sembol} (${toplamTutar} TRY) satin alindi!`;
  });

  this.on('varlikSat', async (req) => {
    const { hesapNo, sembol, adet } = req.data;
    const miktar = Number(adet);
    if (!miktar || miktar <= 0) return req.error(400, 'Gecerli adet giriniz.');

    const hesap = await SELECT.one.from(Hesaplar).where({ hesapNo });
    const varlik = await SELECT.one.from(Piyasa).where({ sembol });
    const mevcutPortfoy = await SELECT.one.from(Portfoy).where({ hesapNo, sembol });

    if (!mevcutPortfoy || Number(mevcutPortfoy.adet) < miktar) {
      return req.error(400, `Portfoyunuzde yeterli ${sembol} yok!`);
    }

    const toplamTutar = Number((Number(varlik.fiyat) * miktar).toFixed(2));
    await UPDATE(Hesaplar).set({ bakiye: Number((Number(hesap.bakiye) + toplamTutar).toFixed(2)) }).where({ hesapNo });

    const kalanAdet = Number(mevcutPortfoy.adet) - miktar;
    if (kalanAdet <= 0) {
      await DELETE.from(Portfoy).where({ ID: mevcutPortfoy.ID });
    } else {
      await UPDATE(Portfoy).set({ adet: kalanAdet }).where({ ID: mevcutPortfoy.ID });
    }

    await INSERT.into(Islemler).entries({
      islemTipi: 'BORSA SATIM',
      gonderenNo: sembol,
      aliciNo: hesapNo,
      tutar: toplamTutar,
      aciklama: `${miktar} adet ${varlik.ad} satisi`
    });

    return `${miktar} adet ${sembol} (${toplamTutar} TRY) satildi!`;
  });

  this.on('faturaOde', async (req) => {
    const { hesapNo, kurum, tutar } = req.data;
    const miktar = Number(tutar);
    const hesap = await SELECT.one.from(Hesaplar).where({ hesapNo });
    if (!hesap) return req.error(404, 'Hesap bulunamadi.');
    if (Number(hesap.bakiye) < miktar) return req.error(400, 'Fatura odemek icin bakiyeniz yetersiz!');

    await UPDATE(Hesaplar).set({ bakiye: Number((Number(hesap.bakiye) - miktar).toFixed(2)) }).where({ hesapNo });

    await INSERT.into(Islemler).entries({
      islemTipi: 'FATURA',
      gonderenNo: hesapNo,
      aliciNo: kurum,
      tutar: miktar,
      aciklama: `${kurum} Fatura Odemesi`
    });

    return `${kurum} faturasi (${miktar} TRY) odendi!`;
  });

  this.on('sansCarki', async (req) => {
    const { hesapNo } = req.data;
    const hesap = await SELECT.one.from(Hesaplar).where({ hesapNo });
    if (!hesap) return req.error(404, 'Hesap bulunamadi.');

    const olaylar = [
      { tutar: 10000, mesaj: 'Buyuk Ikramiye! +10.000 TRY kazandiniz!' },
      { tutar: 5000, mesaj: 'Temettu Odemesi! +5.000 TRY hesabiniza yatti!' },
      { tutar: 2500, mesaj: 'Nakit Iade Bonusu! +2.500 TRY kazandiniz!' },
      { tutar: -2000, mesaj: 'Beklenmedik Vergi Cezasi! -2.000 TRY kesildi.' },
      { tutar: -1500, mesaj: 'Arac Bakim Masrafi! -1.500 TRY odendi.' }
    ];

    const secilen = olaylar[Math.floor(Math.random() * olaylar.length)];
    const yeniBakiye = Math.max(0, Number((Number(hesap.bakiye) + secilen.tutar).toFixed(2)));

    await UPDATE(Hesaplar).set({ bakiye: yeniBakiye }).where({ hesapNo });

    await INSERT.into(Islemler).entries({
      islemTipi: secilen.tutar >= 0 ? 'ODUL' : 'CEZA',
      gonderenNo: secilen.tutar >= 0 ? 'SANS CARKI' : hesapNo,
      aliciNo: secilen.tutar >= 0 ? hesapNo : 'MALIYE / MASRAF',
      tutar: Math.abs(secilen.tutar),
      aciklama: secilen.mesaj
    });

    return secilen.mesaj;
  });
});
