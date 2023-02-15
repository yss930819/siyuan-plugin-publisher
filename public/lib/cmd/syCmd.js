/*
 * Copyright (c) 2022-2023, Terwer . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Terwer designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Terwer in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Terwer, Shenzhen, Guangdong, China, youweics@163.com
 * or visit www.terwer.space if you need additional information or have any
 * questions.
 */

// 警告⚠️：请勿在非思源笔记浏览器环境调用此文件中的任何方法

/**
 * 是否是Electron环境，等价于isInSiyuanOrSiyuanNewWin
 */
const isElectron = /Electron/.test(navigator.userAgent)

const { spawn } = isElectron ? require("child_process") : ""
const process = isElectron ? require("process") : ""

async function cmd(...command) {
  let p = spawn(command[0], command.slice(1))
  return new Promise((resolve, reject) => {
    let output = ""
    try {
      p.stdout.on("data", (x) => {
        // process.stdout.write(x.toString())
        // resolve(x.toString())
        output += x.toString()
      })

      p.stderr.on("data", (x) => {
        // process.stderr.write(x.toString())
        // reject(x.toString())
        output += x.toString()
      })

      p.on("exit", (code) => {
        // resolve(code)
        output += code
      })

      p.on("close", (code) => {
        let ret
        if (!code) {
          ret = { code: 0, data: output }
        } else {
          ret = { code: code, data: output }
        }

        console.log("命令执行完毕.", ret)
        resolve(ret)
      })
    } catch (e) {
      console.log("命令执行出错.", e)
      reject({ code: -1, data: e.toString() })
    }
  })
}

/**
 * 执行shell脚本
 * @param shell
 * @returns {Promise<undefined>}
 */
async function execShellCmd(shell) {
  console.log("exec shell=>", shell)
  const ret = await cmd("bash", "-c", shell)
  console.log("exec finished=>", ret)
  return ret
}

const syCmd = {
  cmd,
  execShellCmd,
}

module.exports = syCmd
