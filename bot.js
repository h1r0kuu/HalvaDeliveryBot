require("dotenv").config()

const { Telegraf, session, Scenes: {WizardScene, Stage} } = require('telegraf')
const bot = new Telegraf(process.env.BOT_TOKEN)

const utils = require("./utils")
const sequelize = require("./models/db_conf")
const models = require("./models/model")
const replyKeyboard = require("./keyboards/replyKeyboard")
const { stage } = require("./scenes");
const { action } = require("./scenes/mailingScene")

bot.use(session())
bot.use(stage.middleware());

bot.start( async ctx => {
    await ctx.scene.leave()

    let res = await models.Customer.findOne({where: {user_id: ctx.message.from.id}})
    if(res === null) {
        await models.Customer.create({
            user_id: ctx.message.from.id
        })
    }
    await ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
    await ctx.scene.enter("choosing_food_scene")
})

bot.command("start", async ctx => {
    await ctx.scene.leave()
    let res = await models.Customer.findOne({where: {user_id: ctx.message.from.id}})
    if(res === null) {
        await models.Customer.create({
            user_id: ctx.message.from.id
        })
    }
   
    await ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
    await ctx.scene.enter("choosing_food_scene")
})

bot.command("admin", async ctx => {
    const isAdmin = await utils.userIsAdmin(ctx.message.from.id)
    if(isAdmin == true) {
        await ctx.scene.leave()
        await ctx.reply("Добро пожаловать в админ панель: ", await replyKeyboard.adminPanel())
    }
})


bot.on("photo", async ctx => {
    console.log(ctx.message.photo)
})

bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true)
})


bot.on("message", async ctx => {
    const userTxt = ctx.message.text
    const userId = ctx.message.from.id
    if(ctx.message.chat.id == process.env.GROUP_ID) {
        if(ctx.message.reply_to_message) {
            const replyText = ctx.message.reply_to_message.text
            const deliveryPrice = ctx.message.text.replace(" ", "")
            if(!isNaN(deliveryPrice)) {
                let orderReg = /Заказ №\d{1,6}/
                let paymentTypeReg = /Способ оплаты: 💵 Наличные|💳 Payme/
                let orderMatch = replyText.match(orderReg)
                let paymentTypeMatch = replyText.match(paymentTypeReg)
                const paymentType = paymentTypeMatch
                const orderId = parseInt(orderMatch[0].split("№")[1])
                if(orderId) {
                    const providerToken = process.env.PAYME_TOKEN
                    const order = await utils.getOrderInfo(orderId)
                    let cart = await utils.getCartInfo2(order.customerUserId, orderId)
                    let cartDishes = cart.cart_dishes
                    let totalPrice = 0
                    cartDishes.forEach(dish => {
                        let price = dish.amount * dish.dish.price 
                        totalPrice += price
                    })
                    totalPrice += parseInt(deliveryPrice)
                    if(order.price_delivery == 0 || order.price_delivery === null) {
                        if(paymentType == "💳 Payme") {
                            let invoice = {
                                chat_id: order.customerUserId, // Уникальный идентификатор целевого чата или имя пользователя целевого канала
                                provider_token: providerToken, // токен выданный через бот @SberbankPaymentBot 
                                start_parameter: 'get_access', //Уникальный параметр глубинных ссылок. Если оставить поле пустым, переадресованные копии отправленного сообщения будут иметь кнопку «Оплатить», позволяющую нескольким пользователям производить оплату непосредственно из пересылаемого сообщения, используя один и тот же счет. Если не пусто, перенаправленные копии отправленного сообщения будут иметь кнопку URL с глубокой ссылкой на бота (вместо кнопки оплаты) со значением, используемым в качестве начального параметра.
                                title: `Оплата через: Payme`, // Название продукта, 1-32 символа
                                description: `Сумма к оплате: ${totalPrice} сум.\nЧто бы оплатить нажми кнопку снизу`, // Описание продукта, 1-255 знаков
                                currency: 'UZS', // Трехбуквенный код валюты ISO 4217
                                prices: [{ label: 'Invoice Title', amount: parseInt(totalPrice) * 100}], // Разбивка цен, сериализованный список компонентов в формате JSON 100 копеек * 100 = 100 рублей
                                payload: { // Полезные данные счета-фактуры, определенные ботом, 1–128 байт. Это не будет отображаться пользователю, используйте его для своих внутренних процессов.
                                    unique_id: `${ctx.message.from.id}_${order.id}`,
                                    provider_token: providerToken
                                }
                            }
                            context = await replyKeyboard.pay()
                            context.parse_mode = "HTML"
                            await ctx.telegram.sendMessage(order.customerUserId, `Оплата через: <b>Payme</b>\nСумма к оплате: ${totalPrice} сум.(включая доставку ${deliveryPrice} сум.) \nЧто бы оплатить нажми кнопку \"✅ Оплатить\"`, context)
                            await ctx.telegram.sendInvoice(order.customerUserId, invoice)
                        } else {
                            await ctx.telegram.sendMessage(order.customerUserId, `Заказ выехал к вам. Время доставки от 50мин. Приблизительная стоимость доставки - <b>${deliveryPrice} сум.</b>`, {parse_mode: "HTML"})
                        }
                    }
                    await utils.updateDelivery(orderId, deliveryPrice)
                }
            } else {
                await ctx.telegram.sendMessage(process.env.GROUP_ID, "Цена должна быть в цифровом формате")
            }
        }
    } else {
        const isAdmin = await utils.userIsAdmin(userId)
        if(isAdmin == true) {
            if(userTxt == "Изменить продукт") {
                await ctx.reply("Введите название продукта")
                await ctx.scene.enter("choose_dish_by_name")
            } else if(userTxt == "Добавить продукт") {
                const catObj = await utils.getCategoryByBranch("Меню")
                await ctx.reply("Выберите категорию для продукта", await replyKeyboard.createOnlyCategoryButtons(catObj.categories))
                await ctx.scene.enter("create_dish_scene")
            } else if(userTxt == "Удалить категорию") {
                const catObj = await utils.getCategoryByBranch("Меню")
                await ctx.reply("Выберите категорию для удаления", await replyKeyboard.createOnlyCategoryButtons(catObj.categories))
                await ctx.scene.enter("delete_category_scene")
            } else if(userTxt == "Добавить категорию") {
                await ctx.reply("Введите название новой категории", await replyKeyboard.cancel())
                await ctx.scene.enter("create_category_scene")
            } else if(userTxt == "Сделать рассылку") {
                await ctx.reply("Какой тип рассылки должен быть?", await replyKeyboard.mailing())
                await ctx.scene.enter("mailing_scene")
            } else if(userTxt == "Количество клиентов") {
                const userIds = await utils.getUserIds()
                const clientNumbers = userIds.length
                await ctx.reply("Количество клиентов - " + clientNumbers)
            } else {
                await ctx.reply("Неизвестная команда", await replyKeyboard.mainMenu())
                await ctx.scene.enter("choosing_food_scene")
            }
        }
    }
})


// bot.on('message', async (ctx) => {
//     if (ctx.update.message.successful_payment != undefined) {
//         await ctx.reply('Thanks for the purchase!')
//         await ctx.reply(JSON.stringify(ctx.update.message))
//     } else {
//         // Handle other message types, subtypes
//     }
// })
// bot.on("callback_query", async ctx => {
//     console.log(ctx.update.callback_query.data)
// })

bot.action(/^confirm:/, async ctx => {
    const data = await ctx.callbackQuery.data.split(":")[1].split("_")
    const messageId = await ctx.callbackQuery.message.message_id
    const orderId = parseInt(data[0])
    const userId = parseInt(data[1])
    await ctx.telegram.sendMessage(userId,`Ваш заказ №${orderId} передан на обработку.\nСейчас Вам позвонит наш оператор.`, await replyKeyboard.mainMenu())
    await ctx.editMessageReplyMarkup(await replyKeyboard.removeKeyboard())
    await ctx.reply(`Заказ №${orderId} подтверждён менеджером @${ctx.callbackQuery.from.username}`)
})

bot.action(/^decline:/, async ctx => {
    const data = await ctx.callbackQuery.data.split(":")[1].split("_")
    const messageId = await ctx.callbackQuery.message.message_id
    const orderId = parseInt(data[0])
    const userId = parseInt(data[1])
    await ctx.telegram.sendMessage(userId, `<b>Ваш заказ №${orderId} отменён!</b>`, {parse_mode: "HTML"})
    await ctx.editMessageReplyMarkup(await replyKeyboard.removeKeyboard())
    await ctx.reply(`Заказ №${orderId} отменён менеджером @${ctx.callbackQuery.from.username}`)
})

bot.action(/^product:/, async ctx => {
    const data = await ctx.callbackQuery.data.split(":")
    const productId = data[1]
    const categoryId = data[2]
    const dishInfo = await models.Dish.findOne({where: {id: productId, categoryId: categoryId}})
    await ctx.replyWithPhoto(dishInfo.file_id, {caption: `${dishInfo.title}\n\n${dishInfo.description}\n\nЦена: <b>${dishInfo.price} сум</b>`, parse_mode: "HTML"})

})

bot.action("phone", async ctx => {
    await ctx.reply("Наши номера телефонов:\n+998946160016\n+998977654568")
})


async function start() {
    bot.telegram.getMe().then( async bot_info => {
        let currTime = new Date();
        console.log(`BOT SUCCESSFULY STARTED ${await utils.currTime()} `+ bot_info.first_name)
    })
    try {
        await sequelize.authenticate()
        await sequelize.sync()
    } catch(e) {
        console.log(e)
    }
}

start()
bot.launch()


process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))