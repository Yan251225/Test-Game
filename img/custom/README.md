# 自定义图片替换指南 / Custom Image Replacement Guide

## 角色立绘 / Character Sprites

将你的角色图片放在此目录下，文件名对应角色ID：

| 文件名 | 角色 |
|--------|------|
| `luchen.png` | 陆辰逸 |
| `guyan.png` | 顾晏时 |
| `linxiao.png` | 林笑寒 |

支持格式：`.png`、`.jpg`、`.webp`

建议尺寸：400×700 像素（竖版半身像）

## 使用方法

1. 将图片文件放入 `img/custom/characters/` 目录
2. 确保文件名与角色ID一致（如 `luchen.png`）
3. 刷新游戏页面即可看到新图片

游戏会自动检测自定义图片，优先使用自定义图片，找不到时回退到内置SVG。
