sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("banka.controller.AnaSayfa", {
        onInit: function () {
            var oModel = new JSONModel({
                hesaplar: [],
                seciliHesap: {},
                islemler: [],
                piyasa: [],
                portfoy: []
            });
            this.getView().setModel(oModel);
            this.onVerileriYukle();
        },

        onVerileriYukle: function () {
            var oModel = this.getView().getModel();
            var sSeciliNo = oModel.getProperty("/seciliHesap/hesapNo");

            Promise.all([
                fetch("/odata/v4/banka/Hesaplar").then(r => r.json()),
                fetch("/odata/v4/banka/Islemler?$orderby=tarih desc").then(r => r.json()),
                fetch("/odata/v4/banka/Piyasa").then(r => r.json()),
                fetch("/odata/v4/banka/Portfoy").then(r => r.json())
            ]).then(function (aRes) {
                var aHesaplar = aRes[0].value || [];
                oModel.setProperty("/hesaplar", aHesaplar);
                oModel.setProperty("/islemler", aRes[1].value || []);
                oModel.setProperty("/piyasa", aRes[2].value || []);
                oModel.setProperty("/portfoy", aRes[3].value || []);

                if (aHesaplar.length > 0) {
                    var oBulunan = aHesaplar.find(function (h) { return h.hesapNo === sSeciliNo; }) || aHesaplar[0];
                    oModel.setProperty("/seciliHesap", oBulunan);
                    this.byId("selHesap").setSelectedKey(oBulunan.hesapNo);
                }
            }.bind(this)).catch(function () {
                MessageBox.error("Sunucuya bağlanılamadı.");
            });
        },

        onHesapDegisti: function (oEvent) {
            var sKey = oEvent.getParameter("selectedItem").getKey();
            var oModel = this.getView().getModel();
            var aHesaplar = oModel.getProperty("/hesaplar");
            var oSecilen = aHesaplar.find(function (h) { return h.hesapNo === sKey; });
            if (oSecilen) {
                oModel.setProperty("/seciliHesap", oSecilen);
            }
        },

        _postAction: function (sAction, oPayload) {
            fetch("/odata/v4/banka/" + sAction, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPayload)
            }).then(async function (res) {
                var data = await res.json();
                if (!res.ok) {
                    MessageBox.error((data.error && data.error.message) || "İşlem başarısız.");
                    return;
                }
                MessageToast.show(data.value || "İşlem tamamlandı!");
                this.onVerileriYukle();
            }.bind(this)).catch(function () {
                MessageBox.error("Sunucu hatası oluştu.");
            });
        },

        onTransferYap: function () {
            var sGonderen = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            var sAlici = this.byId("inpAlici").getValue().trim();
            var fTutar = parseFloat(this.byId("inpTutar").getValue());
            var sAciklama = this.byId("inpAciklama").getValue();

            if (!sAlici || !fTutar || fTutar <= 0) {
                MessageBox.error("Lütfen geçerli bir alıcı hesap no ve tutar girin.");
                return;
            }
            this._postAction("paraTransferi", {
                gonderenNo: sGonderen,
                aliciNo: sAlici,
                tutar: fTutar,
                aciklama: sAciklama
            });
        },

        onKrediCek: function () {
            var sHesap = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            this._postAction("krediCek", { hesapNo: sHesap, tutar: 10000 });
        },

        onKrediOde: function () {
            var sHesap = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            this._postAction("krediOde", { hesapNo: sHesap, tutar: 0 });
        },

        onGunlukFaiz: function () {
            var sHesap = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            this._postAction("gunlukFaiz", { hesapNo: sHesap });
        },

        onPiyasaGuncelle: function () {
            this._postAction("piyasaGuncelle", {});
        },

        onVarlikAl: function (oEvent) {
            var sHesap = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            var sSembol = oEvent.getSource().getBindingContext().getProperty("sembol");
            this._postAction("varlikAl", { hesapNo: sHesap, sembol: sSembol, adet: 1 });
        },

        onVarlikSat: function (oEvent) {
            var sHesap = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            var sSembol = oEvent.getSource().getBindingContext().getProperty("sembol");
            this._postAction("varlikSat", { hesapNo: sHesap, sembol: sSembol, adet: 1 });
        },

        onFaturaOde: function () {
            var sHesap = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            var sKurum = this.byId("selKurum").getSelectedKey();
            var fTutar = parseFloat(this.byId("inpFaturaTutar").getValue());
            this._postAction("faturaOde", { hesapNo: sHesap, kurum: sKurum, tutar: fTutar });
        },

        onYeniHesapAc: function () {
            var sNo = this.byId("inpYeniHesapNo").getValue().trim();
            var sAd = this.byId("inpYeniSahip").getValue().trim();
            var fBakiye = parseFloat(this.byId("inpYeniBakiye").getValue());
            this._postAction("yeniHesapAc", { hesapNo: sNo, sahipAdi: sAd, baslangicBakiye: fBakiye });
        },

        onSansCarki: function () {
            var sHesap = this.getView().getModel().getProperty("/seciliHesap/hesapNo");
            this._postAction("sansCarki", { hesapNo: sHesap });
        }
    });
});
