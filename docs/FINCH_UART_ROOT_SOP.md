# Xiaomi TV `finch` UART Root SOP

**下一步：先确认你的设备确实是 `finch`，再碰任何写入命令。**

这份 SOP 来自一台已实机验证的 `finch`，当时系统为 `OS3.0.115.0.UFFMATV`、活动槽为 **B**、Verified Boot 为 `orange / unlocked`。不同型号、不同槽位或不同固件不要照抄分区写入命令。

## 1. 准备 UART

已验证串口参数：

```text
115200 baud
8 data bits
Parity: None
Stop bits: 1
Flow control: None
DTR: Off
RTS: Off
```

接线：

```text
电视 TX  -> USB-TTL RXD
电视 RX  -> USB-TTL TXD
电视 GND -> USB-TTL GND
VCC / 3.3V / 5V 不接
```

成功的启动日志中能看到：

```text
U-Boot2019.04
Hit any key to stop autoboot
```

> 已验证环境使用 CH340，Windows 端口当时为 `COM3`。COM 号不是固定值，以你电脑实际枚举为准。

## 2. 准备 Magisk boot

本次验证使用从对应 **完整 OTA** 提取的原厂 `boot`，再由 Magisk 30.7 patch。

已验证 patched boot：

```text
文件名: boot_magisk.img
大小:   78,643,200 bytes = 0x4b00000
SHA-256: 5793052e85a92f4fd17ec46084a2ca85193ddb8319c5efa454621e5ec2e99f62
```

同时保留同版本的 `boot_stock.img` 作为回退镜像。把镜像放在 U 盘根目录；不要依赖 Android `/data/local/tmp`，U-Boot 通常无法读取 Android `/data`。

## 3. 截停 U-Boot

1. UART 监听必须先启动。
2. 如果普通 `adb reboot` 抓不到早期串口日志，改用冷启动：断电约 5 秒再上电。
3. 看到 `Hit any key to stop autoboot` 时立即发送按键截停。
4. 成功后应进入类似：

```text
<< finch >>
```

如果没有进入 U-Boot prompt，不要继续任何写入命令。

## 4. 只读确认 U 盘和镜像

先初始化 USB 并列目录：

```text
usb start
fatls usb 0:1
```

必须先看到 `boot_magisk.img`。然后加载到内存：

```text
fatload usb 0:1 0x50000000 boot_magisk.img
```

输出读取大小必须与你实际准备的镜像一致。本次已验证镜像应为：

```text
78643200 bytes
```

也就是：

```text
0x4b00000
```

大小不一致就停止，不要写分区。

## 5. 确认槽位

本次实机验证时 Android 侧活动槽是 `_b`，对应目标分区 `boot_b`。

**不要因为这份 SOP 写的是 B 槽，就默认你的电视也是 B 槽。** 在进入刷写前重新确认活动槽；如果无法确认，停止操作。

本次设备还确认过：

```text
boot_b   -> /dev/block/mmcblk0p27
vbmeta_b -> /dev/block/mmcblk0p34
Verified Boot: orange
Device state: unlocked
```

因此这次没有修改 `vbmeta`。

## 6. 写入已确认的活动 boot 槽

仅当以下条件全部满足时继续：

1. 型号确认是 `finch`。
2. 镜像来自当前目标固件对应的 boot。
3. 文件大小 / SHA-256 已重新核对。
4. 当前活动槽确认是 B。
5. U-Boot 已成功加载完整镜像。

本次验证的写入命令：

```text
partition write mmc 0 boot_b 0x50000000 0x4b00000
```

写入成功后：

```text
reset
```

不要顺手写 `boot_a`，不要修改 `vbmeta`。

## 7. 启动后验证

进入 Android 后检查：

```sh
adb shell su -c id
```

预期能得到 `uid=0(root)`。如果系统无法正常启动，优先使用同版本 `boot_stock.img` 回退，不要继续试写其他分区。

## 已验证结论

- `finch` 的 UART 参数：`115200 / 8N1 / TX-RX 交叉 / 共地 / 不接 VCC`。
- `adb reboot bootloader` 能让电视端进入 fastboot，但本次 Windows 没有枚举到电视 fastboot USB 接口，因此最终可靠路径仍是 UART → U-Boot。
- 本次系统活动槽为 B，因此只写 `boot_b`。
- 本次设备已处于 `orange / unlocked`，无需为了这次 Root 额外改 `vbmeta`。
