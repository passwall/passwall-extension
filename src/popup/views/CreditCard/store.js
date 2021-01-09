const ITEMS = [
  {
    id: 1,
    created_at: "2020-05-02T17:47:42.739124+03:00",
    updated_at: "2020-05-02T17:47:42.739124+03:00",
    deleted_at: null,
    card_name: "Enpara",
    cardholder_name: "Ömer Faruk Oruç",
    type: "Matercard",
    number: "1234-5678-1234-5678",
    verification_number: "000",
    expiry_date: "12/2022",
  },
  {
    id: 1,
    created_at: "2020-05-02T17:47:42.739124+03:00",
    updated_at: "2020-05-02T17:47:42.739124+03:00",
    deleted_at: null,
    card_name: "İş Bankası",
    cardholder_name: "Ömer Faruk Oruç",
    type: "Matercard",
    number: "1234-5678-1234-5678",
    verification_number: "000",
    expiry_date: "12/2022",
  },
];

export default {
  namespaced: true,

  state() {
    return {
      items: ITEMS,
      detail: ITEMS[0],
    };
  },
};
