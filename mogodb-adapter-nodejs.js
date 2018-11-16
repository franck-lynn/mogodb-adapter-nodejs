/**
 * Created by franck.lynn on 2018/11/9.
 * franck_lynn@live.cn
 */
'use strict';

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Object.defineProperty(exports, "__esModule", { value: true });

const helper_1 = require("./helper");
const util_1 = require("../util");
const MongoClient = require('mongodb').MongoClient;
const R = require('ramda')

class mongoAdapterNode {
    constructor(uri, options={useNewUrlParser: true}, dbName='test', collection = 'casbin'){
        // 构造函数,输入数据库的连接地址,用户名和密码.数据库名称
        this.uri = uri;
        // this.options = options;
        this.options = options ;
        // this.dbName = dbName; // 这里先设置默认的是 test 数据库
        this.dbName = dbName ;
        this.col = collection; // 这里先将集合名称设置为 'casbin
    }
    // 创建数据库连接
    
    loadPolicy(model){
        // model参数是.conf文件中定义的,有enforce负责传入
        // 1, 首先需要实现加载 loadPolicy()方法
        // console.log("1, 首先需要实现加载");
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.uri) {
                // throw new Error('invalid file path, file path cannot be empty');
                return;
            }
            yield this.loadPolicyLine(model, helper_1.Helper.loadPolicyLine);
            
        });
    }
    
    loadPolicyLine(model, handler){
        // 转数据库处理
        return __awaiter(this, void 0, void 0, function* () {
            // 连接数据库
            let client;
            try {
                client = yield  MongoClient.connect(this.uri, this.options);
                // 获取数据库名称
                const db = client.db(this.dbName);
                // 获取集合
                const col = db.collection(this.col);
                // 从集合里查询数据库 rSet 是结果集
                let rCousor = yield col.find();
                let rSet = yield rCousor.toArray();
                
                let lines = R.pipe(
                    // 1, 先获取排除了_id属性的一个一个的对象
                    R.map(R.omit(["_id"])),
                    // 2, 排除掉为空的属性
                    R.map(R.reject(R.isEmpty)),
                    // 2, 过滤掉属性为id的值
                    // 3, 以属性值组成新数组,
                    R.map(R.values),
                    // 4, 把数组用, 连接成字符串
                    R.map(R.join(", "))
                )(rSet);

                // console.log(lines);
                // console.log("01,从数据库加载的策略规则:", lines);
                lines.forEach((n, index) => {
                    const line = n.trim();
                    if (!line) {
                        return;
                    }
                    // 这里的n是什么样子? p, alice, data1, read
                    handler(n, model);
                });
                
                
            } catch (e) {
                console.log(e.stack);
            }finally {
                client.close()
            }
        });
        
    }
    
    savePolicy(model){
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.uri) {
                // throw new Error('invalid file path, file path cannot be empty');
                return false;
            }
            let result = [];
            // 获取含有 p 的策略规则
            const pList = model.model.get('p');
            if (!pList) {
                return false;
            }
            pList.forEach(n => {
                // console.log("02,获取含有 p 的策略规则", n.policy);
                // 对数组中的每个数组进行添加属性(即标题栏)操作
                var title = ["p_type", "v0", "v1", 'v2', "v3", "v4", "v5"];
                let r = R.pipe(
                    // 为数组中每个元素头部增加一个 'p' 元素,
                    // 返回的还是一个数组
                    R.map(R.prepend("p")),
                    // 对数组中的每个数组进行添加属性(即标题栏)操作
                    // 并直接转化成对象
                    R.map(R.zipObj(title))
                )(n.policy)
                result = R.concat(result)(r)
                // 经过前面的判断,这里的 p 规则是存在的.
                // 把这个规则添加到转乘对象并添加到:result
            });
            // 获取含有 g 的策略规则
            const gList = model.model.get('g');
            
            if (gList) {
                // 源代码中这里判断为 !gList, 即gList为假,就返回false
                // 但是 pList为真的时候就执行不下去.
                // 所以改为为真的判断才执行,为假的时候就没有了
                // 这样就保存进了文件
                // return false;
                gList.forEach(n => {
                    // 源程序没有实现 g 的策略规则
                    let r = R.pipe(
                        // 为数组中每个元素头部增加一个 'p' 元素,
                        // 返回的还是一个数组
                        R.map(R.prepend("g")),
                        // 对数组中的每个数组进行添加属性(即标题栏)操作
                        // 并直接转化成对象
                        R.map(R.zipObj(title))
                    )(n.policy)
                    result = R.concat(result)(r)
                });
            }
            // 调用保存到数据的方法
            yield this.savePolicyLine(result);
            return true;
        });
    }

    savePolicyLine(arrObj){
        // 将这个数组对象保存到数据库
        return __awaiter(this, void 0, void 0, function* () {
            // 连接数据库
            let client;
            try{
                client = yield  MongoClient.connect(this.uri, this.options);
                // 获取数据库名称
                const db = client.db(this.dbName);
                // 获取集合
                const col = db.collection(this.col);
                /*
                用查询的数组对象在数据库中查找,如果找到就不插入,如果没找到就插入
                1, 先用arrObj查询数据库, 用判断对象相等的办法
                2, 数据库里有没有这个对象,
                       |--没有,就保存,
                       |--有
                          |--是否相等
                              |---不相等--更新
                              |---相等--不管
                */
                console.log("1, arrObj-->", arrObj)
                // 获取数组对象的v0字段
                R.compose(
                    R.map(R.prop('v0')),
                    
                )
                for(let i = 0; i < arrObj.length; i++){
                    let v0Cursor = yield col.find({v0: arrObj[i]['v0']});
                    let v0Arr = yield v0Cursor.toArray();
                    if(R.isEmpty(v0Arr)){
                        // 为空表示数据库中没找到这条记录,这是插入数据库
                        col.insertOne(arrObj[i])
                    }
                }
                
                
            }catch(e){
                console.log(e.stack);
            }finally {
                client.close()
            }
        });
    }
    
    
    /**
     * 把策略规则加入到内存
     * @param sec
     * @param ptype
     * @param rule
     * @returns {Promise<any>}
     */
    addPolicy(sec, ptype, rule){
        return __awaiter(this, void 0, void 0, function * () {
            throw new Error('not implemented');
        });
    }

    /**
     * 从内存中移除策略规则
     * @param sec
     * @param ptype
     * @param rule
     * @returns {Promise<any>}
     */
    removePolicy(sec, ptype, rule){
        // 从内存中移除规则
        return __awaiter(this, void 0, void 0, function * () {
            throw new Error('not implemented');
        });
    }

    /**
     * 移除与指定过滤规则匹配的策略规则
     * @param sec
     * @param ptype
     * @param fieldIndex
     * @param fieldValues
     * @returns {Promise<any>}
     */
    removeFilteredPolicy(sec, ptype, fieldIndex, ...fieldValues){
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });

    }
}

// exports.mongoAdapterNode = mongoAdapterNode;
export default  mongoAdapterNode;










