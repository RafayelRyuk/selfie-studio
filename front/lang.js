const LANG = {
    ru: {
      title: "Выберите дату",
      popupTitle: "Ваше бронирование",
      namePlaceholder: "Ваше имя",
      phonePlaceholder: "Ваш телефон",
      submit: "Отправить",
      close: "Закрыть",
      formatDate: (date) =>
        date.toLocaleDateString("ru-RU", { weekday: "long", month: "long", day: "numeric" })
    },
  
    hy: {
      title: "Ընտրեք օրը",
      popupTitle: "Ձերը ամրագրումը",
      namePlaceholder: "Ձեր անունը",
      phonePlaceholder: "Ձեր հեռախոսահամարը",
      submit: "Ուղարկել",
      close: "Փակել",
      formatDate: (date) =>
        date.toLocaleDateString("hy-AM", { weekday: "long", month: "long", day: "numeric" })
    }
  };
  
  let currentLang = "ru";
  