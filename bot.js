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
        } else {
            await ctx.reply("Неизвестная команда", await replyKeyboard.mainMenu())
            await ctx.scene.enter("choosing_food_scene")
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
    await ctx.telegram.sendMessage(userId, `<b>Мы начали готовить Ваш заказ.\nВремя доставки от 50 минут.Благодарим за заказ!😊</b>`, {parse_mode: "HTML"})
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
        console.log(`BOT SUCCESSFULY STARвввTED ${await utils.currTime()} `+ bot_info.first_name)
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