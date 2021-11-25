require("dotenv").config()
const replyKeyboard = require("./keyboards/replyKeyboard")
const {Scenes: {Stage}} = require("telegraf");
const utils = require("./utils");
const { Customer, Branch, Admins } = require("./models/model");

var requireScenes = require("require-all")({
  dirname: __dirname + "/scenes",
  recursive: false,
});


var scenes = [];
Object.keys(requireScenes).map((v) => scenes.push(requireScenes[v]));


const stage = new Stage(scenes);


stage.hears("😊 Поболтаем? (📱контакты, если кто не понял)", async ctx => {
  await ctx.reply("\nФилиал: Ресторан HALVA.\nАдрес: г.Ташкент, ул.Лабзак, Парк \"Навруз\"\nОриентир: (ориентир \"Анхор Локомотив\").\nКонтакты:\n@halva_artcafe_shop\n+998946160016\n+998977654568\n\nРежим работы с 11:00 до 23:00 ежедневно\n\nВот то место — N 41.325886 E 69.266108.\nПостроить маршрут в Яндекс.Навигаторе:  https://yandex.ru/navi/?whatshere[point]=69.266108,41.325886&whatshere[zoom]=18&lang=ru&from=navi", await replyKeyboard.chooseFillial())
  context = await replyKeyboard.back()
  context.parse_mode = 'HTML'
  await ctx.reply("&#8288;", context)
})

stage.hears("😇 Оставим отзыв?", async (ctx) => {
  await ctx.scene.leave()
  await ctx.reply("ℹ️Вы можете оценить наш сервис обслуживания или сообщить о возможной ошибке в боте", await replyKeyboard.back())
  await ctx.scene.enter("review_scene") 
})

stage.hears("🏠 На главную", async ctx => {
  await ctx.scene.leave()
  await ctx.reply("Отлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu() )
  return ctx.scene.enter("choosing_food_scene")
})

stage.hears("🚖 Оформить заказ", async ctx => {
  try {
    await ctx.scene.leave()
    let cart = await utils.getCartInfo(ctx.message.from.id)
    if(cart !== null) {
      let cartDishes = cart.cart_dishes
    
      if(cartDishes.length > 0) {
        await ctx.scene.leave()
        await ctx.scene.enter("order")
      } else {
        await ctx.scene.leave()
        await ctx.reply("Ваша корзина пуста", await replyKeyboard.mainMenu())
        await ctx.scene.enter("choosing_food_scene")
      }
    } else {
      await ctx.scene.leave()
      await ctx.reply("Ваша корзина пуста", await replyKeyboard.mainMenu())
      await ctx.scene.enter("choosing_food_scene")
    }
  } catch(e) {
    await utils.sendError(ctx, e)
  }
})

stage.start( async ctx => {
  await ctx.scene.leave()
  let res = await Customer.findOne({where: {user_id: ctx.message.from.id}})
  if(res === null) {
      await Customer.create({
          user_id: ctx.message.from.id
      })
  }
  await ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
  await ctx.scene.enter("choosing_food_scene")
})

stage.command("admin", async ctx => {
  const isAdmin = await utils.userIsAdmin(ctx.message.from.id)
  if(isAdmin == true) {
      await ctx.scene.leave()
      await ctx.reply("Добро пожаловать в админ панель: ", await replyKeyboard.adminPanel())
  }
})

stage.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true)
})

stage.on('successful_payment', async (ctx) => {
  const orderId = JSON.parse(ctx.message.successful_payment.invoice_payload).unique_id.split("_")[1]
  await ctx.reply(`Ваш заказ #${order.id} передан на обработку.\nСейчас Вам позвонит наш оператор.`)
  await ctx.telegram.sendMessage(process.env.GROUP_ID, `
  Пользователь @${ctx.message.from.username} успешно оплатил заказ №${orderId}
`)
  await setTimeout( async () => {
    await ctx.scene.leave()
    await ctx.reply("Как вам блюдо? Также просим оставить отзыв по доставке", await replyKeyboard.back())
    await ctx.scene.enter("review_scene") 
  }, 7200000)
  await ctx.scene.enter("choosing_food_scene")

})

stage.action(/^confirm:(\d+)$/, async ctx => {
  const data = ctx.match[1].split("_")
  console.log(ctx)
  const orderId = parseInt(data[0])
  const userId = parseInt(data[1])
  ctx.telegram.sendMessage(userId, `<b>Мы начали готовить Ваш заказ.\nВремя доставки от 50 минут.Благодарим за заказ!😊</b>`, {parse_mode: "HTML"})

})

// stage.hears("🔎 Поиск продукта по названию", async ctx => {
//   await ctx.scene.leave()
//   await ctx.reply("Введите название продукта")
//   await ctx.scene.enter("choose_dish_by_name")
// })

// stage.hears("📥 Корзина", async ctx => {
//   await ctx.scene.leave()
//   let cart = await utils.getCartInfo(ctx.message.from.id)

//   if(cart !== null) {
//     let cartDishes = cart.cart_dishes
//     const text = await utils.getCartText(cartDishes)
//     if(cartDishes.length > 0) {
//       context = replyKeyboard.keyboardForCart(cartDishes)
//       context.parse_mode = "HTML"
//       await ctx.reply(text, context)
//     } else {
//       await ctx.scene.leave()
//       await ctx.reply(text, replyKeyboard.mainMenu())
//       await ctx.scene.enter("choosing_food_scene")
//     }
//   } else {
//     await ctx.scene.leave()
//     await ctx.reply("Ваша корзина пуста", replyKeyboard.mainMenu())
//     await ctx.scene.enter("choosing_food_scene")
//   }
// })

module.exports = {stage}
