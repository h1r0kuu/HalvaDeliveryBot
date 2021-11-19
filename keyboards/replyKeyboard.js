const { Keyboard, Key } = require('telegram-keyboard')
const utils = require("../utils")
const {Markup} = require("telegraf")
const {Branch} = require("../models/model")
const controller = require('../controller')

module.exports = {
    async mainMenu() {

        const branches = await Branch.findAll()
        const branchNames = []
        branches.forEach( branch => {
            branchNames.push(branch.name)
        } )
        const keyboard = Keyboard.reply([
            branchNames,
            ["😊 Поболтаем? (📱контакты, если кто не понял)"],
            ["😇 Оставим отзыв?"]
        ])

        return keyboard
    },

    chooseFillial() {
        return Keyboard.make([
            Key.url("Написать сообщение", "https://t.me/halva_artcafe_shop"),
            Key.callback("Позвонить", "phone")
        ]).inline()
    },

    createCategoryButtons(categories) {
        let keyboardArr = []
        categories.forEach( category => {
            keyboardArr.push( category.name )
        })
        const keyboard = Keyboard.make(keyboardArr , { columns: 2 })
        const btn = Keyboard.make([
            ["🚖 Оформить заказ"],
            ["📥 Корзина","⬅️ назад"]
        ])


        return Keyboard.combine(keyboard, btn).reply()

    },

    createOnlyCategoryButtons(categories) {
        let keyboardArr = []
        categories.forEach( category => {
            keyboardArr.push( category.name )
        })
        let keyboard = Keyboard.make(keyboardArr, { columns: 2 })
        let backBtn = Keyboard.make([["⬅️ назад"]]) 
        return Keyboard.combine(keyboard, backBtn).reply() 
    },

    createDishesButtons(dishes) {
        let keyboardArr = []
        dishes.forEach( dish => {
            keyboardArr.push( dish.title )
        })
        
        const before = Keyboard.make([ ["📥 Корзина"] ])
        const keyboard = Keyboard.make(keyboardArr , { columns: 2 })
        const after = Keyboard.make([ ["🏠 На главную","⬅️ назад"] ])


        return Keyboard.combine(before, keyboard, after).reply()
    },

    dishCount() {
        return Keyboard.reply([
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["📥 Корзина", "⬅️ назад"]
        ])
    },

    keyboardForCart(cartDishes) {
        let keyboardArr = []
        
        cartDishes.forEach( dishcart => {
            let dish = dishcart.dish
            keyboardArr.push( `❌ ${dish.title}` )
        })
        const keyboard = Keyboard.make(keyboardArr , { columns: 2 })
        const after = Keyboard.make([ ["⬅️ назад", "🔄 Очистить"], ["🚖 Оформить заказ"] ])
        return Keyboard.combine(keyboard, after).reply()
    },

   async sendLocation(userId) {
        let keyboardsArray = [
            [Markup.button.locationRequest('📍 Отправить геолокацию')],
            // addresses.reply_markup.keyboard,
            // ["⬅️ назад"]
        ]
        let addressesList = await controller.getCustomerAddresses(userId)
        
        if(addressesList.length > 0) {
            let addresses = await Keyboard.make( addressesList, {columns: 2} ).reply()
            addresses.reply_markup.keyboard.forEach( async keyboard => {
                await keyboardsArray.push(keyboard)
            }) 
        }
        
        await keyboardsArray.push(["⬅️ назад"])
        const keyboard = await Markup.keyboard(keyboardsArray,).resize()

        return keyboard
    },

    sendContacts(d) {
        const keyboard = Markup.keyboard([
            [Markup.button.contactRequest('Отправить контакты')],
            ["⬅️ назад"]
        ]
        ).resize()
        return keyboard
    },

    paymentMethod() {
        return Keyboard.reply([
            ["💵 Наличные", "💳 Payme"],
            ["⬅️ назад"]
        ])
    },
    confirm() {
        return Keyboard.reply([
            ["✅ Заказываю!"],
            ["❌ Отменить"]
        ])
    },

    confirmAdmin(orderId, user_id) {
        return Keyboard.make([
            Key.callback("✅ Подтвердить", `confirm:${orderId}_${user_id}`),
            Key.callback("❌ Отменить", `decline:${orderId}_${user_id}`)
        ]).inline()
    },

    pay() {
        return Keyboard.make( Key.callback("✅ Оплатить", `confirm:$}`) ).inline()
    },

    yesNo() {
        return Keyboard.reply([
            ["Приборы и салфетки нужны ✅"], 
            ["Приборы и салфетки не нужны ❌"],
            ["❌ Отмена"],
        ])
    },

    adminPanel() {
        return Keyboard.reply([
            ["Изменить продукт", "Добавить продукт"],
            ["Удалить категорию", "Добавить категорию"],
            ["Сделать рассылку"],
        ])
    },

    removeKeyboard() {
        return Keyboard.remove()
    },

    productOptions() {
        return Keyboard.reply([
            ["Изменить фото", "Изменить состав"],
            ["Изменить название", "Изменить цену"],
            ["Удалить продукт"],
            ["⬅️ назад"],
        ])
    },

    confirmDishCreating() {
        return Keyboard.reply([
            ["✅ Да"],
            ["❌ Нет"],
        ])
    },

    back() {
        return Keyboard.reply([
            ["⬅️ назад"],
        ])
    },

    mailing() {
        return Keyboard.reply([
            ["Рассылка продукта", "Обычная рассылка"],
            ["⬅️ назад"],
        ])
    },
    
    productBtn(productText, productId, categoryId) {
        return Keyboard.make([
            Key.callback(`${productText}`, `product:${productId}:${categoryId}`)
        ]).inline()
    },

    cancel() {
        return Keyboard.reply([
            ["❌ Отмена"]
        ])
    }
}