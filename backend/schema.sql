USE [Moon]
GO
/****** Object:  Table [dbo].[clientes]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[clientes](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[nombre_cliente] [varchar](255) NOT NULL,
	[telefono] [varchar](50) NULL,
	[correo] [varchar](255) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[cuentas]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[cuentas](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[marca_id] [int] NULL,
	[banco] [nvarchar](max) NULL,
	[no_cuenta] [nvarchar](max) NULL,
 CONSTRAINT [PK_cuentas] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[detalle_retiro]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[detalle_retiro](
	[detalle_id] [int] NOT NULL,
	[retiro_id] [int] NULL,
	[producto_id] [int] NULL,
	[Cantidad] [int] NULL,
 CONSTRAINT [PK_detalle_retiro] PRIMARY KEY CLUSTERED 
(
	[detalle_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[estados]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[estados](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[modulo] [varchar](100) NOT NULL,
	[nombre] [varchar](100) NOT NULL,
	[descripcion] [varchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ingreso_detalles]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ingreso_detalles](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[ingreso_id] [int] NOT NULL,
	[producto_id] [int] NOT NULL,
	[cantidad] [int] NOT NULL,
	[precio_ingreso] [decimal](12, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ingresos]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ingresos](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[marca_id] [int] NOT NULL,
	[usuario_id] [int] NOT NULL,
	[tipo_carga] [varchar](100) NOT NULL,
	[observaciones] [varchar](max) NULL,
	[estado_id] [int] NOT NULL,
	[fecha_ingreso] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[kardex]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[kardex](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[producto_id] [int] NOT NULL,
	[usuario_id] [int] NOT NULL,
	[tipo_movimiento] [varchar](100) NOT NULL,
	[cantidad] [int] NOT NULL,
	[referencia_id] [int] NULL,
	[motivo] [varchar](max) NULL,
	[fecha] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[liquidacion_detalles]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[liquidacion_detalles](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[liquidacion_id] [int] NOT NULL,
	[producto_id] [int] NOT NULL,
	[cantidad_vendida] [int] NOT NULL,
	[monto_efectivo] [decimal](12, 2) NULL,
	[monto_tarjeta] [decimal](12, 2) NULL,
	[comision_pos] [decimal](12, 2) NULL,
	[subtotal_neto] [decimal](12, 2) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[liquidaciones]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[liquidaciones](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[marca_id] [int] NOT NULL,
	[periodo_inicio] [date] NOT NULL,
	[periodo_fin] [date] NOT NULL,
	[total_bruto] [decimal](12, 2) NOT NULL,
	[total_comision_pos] [decimal](12, 2) NOT NULL,
	[total_neto_pagar] [decimal](12, 2) NOT NULL,
	[estado_id] [int] NOT NULL,
	[pdf_url] [varchar](max) NULL,
	[fecha_generacion] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[marcas]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[marcas](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[nombre_marca] [varchar](255) NOT NULL,
	[cedula] [nvarchar](100) NULL,
	[contacto_nombre] [varchar](255) NULL,
	[telefono] [varchar](50) NULL,
	[email] [varchar](255) NULL,
	[categoria] [nvarchar](max) NULL,
	[ciudad_pais] [nvarchar](max) NULL,
	[razon_social] [nvarchar](max) NULL,
	[redes_sociales] [nvarchar](max) NULL,
	[cargo] [nvarchar](max) NULL,
	[nombre_representante] [nvarchar](max) NULL,
	[tiempo_estancia] [float] NULL,
	[fecha_ingreso] [datetime] NULL,
	[catalogo] [nvarchar](max) NULL,
	[estado_id] [int] NOT NULL,
	[cuentas] [int] NULL,
	[fecha_registro] [datetime] NULL,
	[codigo] [nvarchar](max) NULL,
	[logo] [nvarchar](max) NULL,
 CONSTRAINT [PK__marcas__3213E83FB123F4E2] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[metodo_pago]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[metodo_pago](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[metodo_pago] [varchar](100) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[pagos_venta]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[pagos_venta](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[venta_id] [int] NOT NULL,
	[metodo_pago] [varchar](100) NOT NULL,
	[monto] [decimal](12, 2) NOT NULL,
	[comision_porcentaje] [decimal](5, 4) NULL,
	[monto_comision] [decimal](12, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[productos]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[productos](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[marca_id] [int] NOT NULL,
	[codigo_qr] [varchar](255) NOT NULL,
	[sku] [varchar](100) NULL,
	[nombre] [varchar](255) NOT NULL,
	[descripcion] [varchar](max) NULL,
	[precio] [decimal](12, 2) NOT NULL,
	[costo_usd] [decimal](14, 6) NULL,
	[tamano] [varchar](max) NULL,
	[stock_critico] [int] NOT NULL,
	[stock_inicial] [int] NOT NULL CONSTRAINT [DF_productos_stock_inicial] DEFAULT ((0)),
	[imagen_url] [varchar](max) NULL,
	[estado_id] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[renta]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[renta](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[marca_id] [int] NULL,
	[fecha_pago] [datetime] NULL,
	[monto] [float] NULL,
 CONSTRAINT [PK_renta] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[renta_pago]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[renta_pago](
	[pago_id] [int] IDENTITY(1,1) NOT NULL,
	[renta_id] [int] NULL,
	[monto_pagado] [float] NULL,
	[fecha_pago] [datetime] NULL,
	[comentario] [nvarchar](max) NULL,
 CONSTRAINT [PK_renta_pago] PRIMARY KEY CLUSTERED 
(
	[pago_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[retiros]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[retiros](
	[id] [int] NOT NULL,
	[marca_id] [int] NOT NULL,
	[usuario_id] [int] NOT NULL,
	[fecha_retiro] [date] NOT NULL,
	[motivo] [varchar](max) NOT NULL,
	[estado_id] [int] NOT NULL,
 CONSTRAINT [PK__retiros__3213E83F8EB5B8AB] PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[usuarios]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[usuarios](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[nombre] [varchar](255) NOT NULL,
	[email] [varchar](255) NOT NULL,
	[usuario] [varchar](100) NOT NULL,
	[pass] [varchar](255) NOT NULL,
	[rol] [varchar](50) NOT NULL,
	[estado_id] [int] NOT NULL,
	[creado_en] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[usuario] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[venta_detalles]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[venta_detalles](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[venta_id] [int] NOT NULL,
	[producto_id] [int] NOT NULL,
	[cantidad] [int] NOT NULL,
	[precio_unitario] [decimal](12, 2) NOT NULL,
	[descuento] [decimal](12, 2) NOT NULL,
	[subtotal] [decimal](12, 2) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ventas]    Script Date: 15/10/2026 06:12:18 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ventas](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[usuario_id] [int] NOT NULL,
	[cliente_id] [bigint] NOT NULL,
	[metodo_pago_id] [bigint] NOT NULL,
	[total] [decimal](12, 2) NOT NULL,
	[comision_pos] [decimal](12, 2) NOT NULL,
	[estado_id] [int] NOT NULL,
	[fecha_venta] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[ingresos] ADD  DEFAULT (getdate()) FOR [fecha_ingreso]
GO
ALTER TABLE [dbo].[kardex] ADD  DEFAULT (getdate()) FOR [fecha]
GO
ALTER TABLE [dbo].[liquidacion_detalles] ADD  DEFAULT ((0)) FOR [monto_efectivo]
GO
ALTER TABLE [dbo].[liquidacion_detalles] ADD  DEFAULT ((0)) FOR [monto_tarjeta]
GO
ALTER TABLE [dbo].[liquidacion_detalles] ADD  DEFAULT ((0)) FOR [comision_pos]
GO
ALTER TABLE [dbo].[liquidaciones] ADD  DEFAULT ((0)) FOR [total_bruto]
GO
ALTER TABLE [dbo].[liquidaciones] ADD  DEFAULT ((0)) FOR [total_comision_pos]
GO
ALTER TABLE [dbo].[liquidaciones] ADD  DEFAULT ((0)) FOR [total_neto_pagar]
GO
ALTER TABLE [dbo].[liquidaciones] ADD  DEFAULT (getdate()) FOR [fecha_generacion]
GO
ALTER TABLE [dbo].[pagos_venta] ADD  DEFAULT ((0)) FOR [comision_porcentaje]
GO
ALTER TABLE [dbo].[pagos_venta] ADD  DEFAULT ((0)) FOR [monto_comision]
GO
ALTER TABLE [dbo].[productos] ADD  DEFAULT ((5)) FOR [stock_critico]
GO
ALTER TABLE [dbo].[retiros] ADD  CONSTRAINT [DF__retiros__fecha_r__59063A47]  DEFAULT (CONVERT([date],getdate())) FOR [fecha_retiro]
GO
ALTER TABLE [dbo].[usuarios] ADD  DEFAULT (getdate()) FOR [creado_en]
GO
ALTER TABLE [dbo].[venta_detalles] ADD  DEFAULT ((0)) FOR [descuento]
GO
ALTER TABLE [dbo].[ventas] ADD  DEFAULT ((0)) FOR [total]
GO
ALTER TABLE [dbo].[ventas] ADD  DEFAULT ((0)) FOR [comision_pos]
GO
ALTER TABLE [dbo].[ventas] ADD  DEFAULT (getdate()) FOR [fecha_venta]
GO
ALTER TABLE [dbo].[cuentas]  WITH CHECK ADD  CONSTRAINT [FK_cuentas_marcas] FOREIGN KEY([marca_id])
REFERENCES [dbo].[marcas] ([id])
GO
ALTER TABLE [dbo].[cuentas] CHECK CONSTRAINT [FK_cuentas_marcas]
GO
ALTER TABLE [dbo].[detalle_retiro]  WITH CHECK ADD  CONSTRAINT [FK_detalle_retiro_productos] FOREIGN KEY([producto_id])
REFERENCES [dbo].[productos] ([id])
GO
ALTER TABLE [dbo].[detalle_retiro] CHECK CONSTRAINT [FK_detalle_retiro_productos]
GO
ALTER TABLE [dbo].[detalle_retiro]  WITH CHECK ADD  CONSTRAINT [FK_detalle_retiro_retiros] FOREIGN KEY([retiro_id])
REFERENCES [dbo].[retiros] ([id])
GO
ALTER TABLE [dbo].[detalle_retiro] CHECK CONSTRAINT [FK_detalle_retiro_retiros]
GO
ALTER TABLE [dbo].[ingreso_detalles]  WITH CHECK ADD  CONSTRAINT [fk_ingreso_detalles_ingreso] FOREIGN KEY([ingreso_id])
REFERENCES [dbo].[ingresos] ([id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[ingreso_detalles] CHECK CONSTRAINT [fk_ingreso_detalles_ingreso]
GO
ALTER TABLE [dbo].[ingreso_detalles]  WITH CHECK ADD  CONSTRAINT [fk_ingreso_detalles_producto] FOREIGN KEY([producto_id])
REFERENCES [dbo].[productos] ([id])
GO
ALTER TABLE [dbo].[ingreso_detalles] CHECK CONSTRAINT [fk_ingreso_detalles_producto]
GO
ALTER TABLE [dbo].[ingresos]  WITH CHECK ADD  CONSTRAINT [fk_ingresos_estado] FOREIGN KEY([estado_id])
REFERENCES [dbo].[estados] ([id])
GO
ALTER TABLE [dbo].[ingresos] CHECK CONSTRAINT [fk_ingresos_estado]
GO
ALTER TABLE [dbo].[ingresos]  WITH CHECK ADD  CONSTRAINT [fk_ingresos_marca] FOREIGN KEY([marca_id])
REFERENCES [dbo].[marcas] ([id])
GO
ALTER TABLE [dbo].[ingresos] CHECK CONSTRAINT [fk_ingresos_marca]
GO
ALTER TABLE [dbo].[ingresos]  WITH CHECK ADD  CONSTRAINT [fk_ingresos_usuario] FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO
ALTER TABLE [dbo].[ingresos] CHECK CONSTRAINT [fk_ingresos_usuario]
GO
ALTER TABLE [dbo].[kardex]  WITH CHECK ADD  CONSTRAINT [fk_kardex_producto] FOREIGN KEY([producto_id])
REFERENCES [dbo].[productos] ([id])
GO
ALTER TABLE [dbo].[kardex] CHECK CONSTRAINT [fk_kardex_producto]
GO
ALTER TABLE [dbo].[kardex]  WITH CHECK ADD  CONSTRAINT [fk_kardex_usuario] FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO
ALTER TABLE [dbo].[kardex] CHECK CONSTRAINT [fk_kardex_usuario]
GO
ALTER TABLE [dbo].[liquidacion_detalles]  WITH CHECK ADD  CONSTRAINT [fk_liq_detalles_liquidacion] FOREIGN KEY([liquidacion_id])
REFERENCES [dbo].[liquidaciones] ([id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[liquidacion_detalles] CHECK CONSTRAINT [fk_liq_detalles_liquidacion]
GO
ALTER TABLE [dbo].[liquidacion_detalles]  WITH CHECK ADD  CONSTRAINT [fk_liq_detalles_producto] FOREIGN KEY([producto_id])
REFERENCES [dbo].[productos] ([id])
GO
ALTER TABLE [dbo].[liquidacion_detalles] CHECK CONSTRAINT [fk_liq_detalles_producto]
GO
ALTER TABLE [dbo].[liquidaciones]  WITH CHECK ADD  CONSTRAINT [fk_liquidaciones_estado] FOREIGN KEY([estado_id])
REFERENCES [dbo].[estados] ([id])
GO
ALTER TABLE [dbo].[liquidaciones] CHECK CONSTRAINT [fk_liquidaciones_estado]
GO
ALTER TABLE [dbo].[liquidaciones]  WITH CHECK ADD  CONSTRAINT [fk_liquidaciones_marca] FOREIGN KEY([marca_id])
REFERENCES [dbo].[marcas] ([id])
GO
ALTER TABLE [dbo].[liquidaciones] CHECK CONSTRAINT [fk_liquidaciones_marca]
GO
ALTER TABLE [dbo].[marcas]  WITH CHECK ADD  CONSTRAINT [fk_marcas_estado] FOREIGN KEY([estado_id])
REFERENCES [dbo].[estados] ([id])
GO
ALTER TABLE [dbo].[marcas] CHECK CONSTRAINT [fk_marcas_estado]
GO
ALTER TABLE [dbo].[pagos_venta]  WITH CHECK ADD  CONSTRAINT [fk_pagos_venta_venta] FOREIGN KEY([venta_id])
REFERENCES [dbo].[ventas] ([id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[pagos_venta] CHECK CONSTRAINT [fk_pagos_venta_venta]
GO
ALTER TABLE [dbo].[productos]  WITH CHECK ADD  CONSTRAINT [fk_productos_estado] FOREIGN KEY([estado_id])
REFERENCES [dbo].[estados] ([id])
GO
ALTER TABLE [dbo].[productos] CHECK CONSTRAINT [fk_productos_estado]
GO
ALTER TABLE [dbo].[productos]  WITH CHECK ADD  CONSTRAINT [fk_productos_marca] FOREIGN KEY([marca_id])
REFERENCES [dbo].[marcas] ([id])
GO
ALTER TABLE [dbo].[productos] CHECK CONSTRAINT [fk_productos_marca]
GO
ALTER TABLE [dbo].[renta]  WITH CHECK ADD  CONSTRAINT [FK_renta_marcas] FOREIGN KEY([marca_id])
REFERENCES [dbo].[marcas] ([id])
GO
ALTER TABLE [dbo].[renta] CHECK CONSTRAINT [FK_renta_marcas]
GO
ALTER TABLE [dbo].[renta_pago]  WITH CHECK ADD  CONSTRAINT [FK_renta_pago_renta] FOREIGN KEY([renta_id])
REFERENCES [dbo].[renta] ([id])
GO
ALTER TABLE [dbo].[renta_pago] CHECK CONSTRAINT [FK_renta_pago_renta]
GO
ALTER TABLE [dbo].[retiros]  WITH CHECK ADD  CONSTRAINT [fk_retiros_estado] FOREIGN KEY([estado_id])
REFERENCES [dbo].[estados] ([id])
GO
ALTER TABLE [dbo].[retiros] CHECK CONSTRAINT [fk_retiros_estado]
GO
ALTER TABLE [dbo].[retiros]  WITH CHECK ADD  CONSTRAINT [fk_retiros_marca] FOREIGN KEY([marca_id])
REFERENCES [dbo].[marcas] ([id])
GO
ALTER TABLE [dbo].[retiros] CHECK CONSTRAINT [fk_retiros_marca]
GO
ALTER TABLE [dbo].[retiros]  WITH CHECK ADD  CONSTRAINT [fk_retiros_usuario] FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO
ALTER TABLE [dbo].[retiros] CHECK CONSTRAINT [fk_retiros_usuario]
GO
ALTER TABLE [dbo].[usuarios]  WITH CHECK ADD  CONSTRAINT [fk_usuarios_estado] FOREIGN KEY([estado_id])
REFERENCES [dbo].[estados] ([id])
GO
ALTER TABLE [dbo].[usuarios] CHECK CONSTRAINT [fk_usuarios_estado]
GO
ALTER TABLE [dbo].[venta_detalles]  WITH CHECK ADD  CONSTRAINT [fk_venta_detalles_producto] FOREIGN KEY([producto_id])
REFERENCES [dbo].[productos] ([id])
GO
ALTER TABLE [dbo].[venta_detalles] CHECK CONSTRAINT [fk_venta_detalles_producto]
GO
ALTER TABLE [dbo].[venta_detalles]  WITH CHECK ADD  CONSTRAINT [fk_venta_detalles_venta] FOREIGN KEY([venta_id])
REFERENCES [dbo].[ventas] ([id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[venta_detalles] CHECK CONSTRAINT [fk_venta_detalles_venta]
GO
ALTER TABLE [dbo].[ventas]  WITH CHECK ADD  CONSTRAINT [fk_ventas_cliente] FOREIGN KEY([cliente_id])
REFERENCES [dbo].[clientes] ([id])
GO
ALTER TABLE [dbo].[ventas] CHECK CONSTRAINT [fk_ventas_cliente]
GO
ALTER TABLE [dbo].[ventas]  WITH CHECK ADD  CONSTRAINT [fk_ventas_estado] FOREIGN KEY([estado_id])
REFERENCES [dbo].[estados] ([id])
GO
ALTER TABLE [dbo].[ventas] CHECK CONSTRAINT [fk_ventas_estado]
GO
ALTER TABLE [dbo].[ventas]  WITH CHECK ADD  CONSTRAINT [fk_ventas_metodo_pago] FOREIGN KEY([metodo_pago_id])
REFERENCES [dbo].[metodo_pago] ([id])
GO
ALTER TABLE [dbo].[ventas] CHECK CONSTRAINT [fk_ventas_metodo_pago]
GO
ALTER TABLE [dbo].[ventas]  WITH CHECK ADD  CONSTRAINT [fk_ventas_usuario] FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO
ALTER TABLE [dbo].[ventas] CHECK CONSTRAINT [fk_ventas_usuario]
GO
