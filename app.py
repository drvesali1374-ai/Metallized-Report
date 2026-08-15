import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import os
import xml.etree.ElementTree as ET

# تنظیمات صفحه
st.set_page_config(
    page_title="سیستم مدیریت ستاپ و داشبورد تولید فیلم PP",
    page_icon="🏭",
    layout="wide"
)

# عنوان برنامه
st.title("🏭 سیستم مدیریت ستاپ و داشبورد تولید فیلم نازک PP")

# مسیر فایل‌ها
SETUP_FILE = "setup_data.xlsx"
ROLL_EXPORT_FILE = "Roll Export.xls"
ARCHIVED_ROLL_FILE = "Archived Roll Export.xls"

# تابع برای خواندن فایل‌های XML Excel
def read_xml_excel(filepath):
    """خواندن فایل‌های Excel با فرمت XML"""
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
        ns = {'ss': 'urn:schemas-microsoft-com:office:spreadsheet'}
        
        rows = []
        for row in root.findall('.//ss:Row', ns):
            cells = []
            for cell in row.findall('.//ss:Cell', ns):
                data = cell.find('ss:Data', ns)
                if data is not None and data.text:
                    cells.append(data.text)
                else:
                    cells.append(None)
            if cells:
                rows.append(cells)
        
        if rows:
            df = pd.DataFrame(rows[1:], columns=rows[0])
            return df
        return pd.DataFrame()
    except Exception as e:
        st.error(f"خطا در خواندن فایل {filepath}: {e}")
        return pd.DataFrame()

# ایجاد تب‌های مختلف
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "📝 ورود ستاپ جدید",
    "📊 لیست ستاپ‌ها",
    "📦 موجودی رول‌های خام",
    "✨ رول‌های متالایز شده",
    "✂️ فرزندان برش شده",
    "⏱️ وضعیت دستگاه‌ها"
])

# ============================================================
# تب 1: ورود ستاپ جدید
# ============================================================
with tab1:
    st.header("📝 ثبت ستاپ جدید (رول مادر)")
    
    with st.form("setup_form"):
        col1, col2, col3 = st.columns(3)
        
        with col1:
            order_number = st.text_input("شماره سفارش", "")
            mother_roll_id = st.text_input("شناسه رول مادر", "")
            roll_width = st.number_input("عرض رول مادر (mm)", min_value=0.0, step=1.0)
            roll_type = st.selectbox("نوع رول", ["PP", "BOPP", "CPP", "Other"])
        
        with col2:
            machine_number = st.selectbox("شماره دستگاه", [1, 2, 3, 4, 5, 6, 7, 8])
            quantity = st.number_input("تعداد", min_value=1, value=1)
            length = st.number_input("متراژ (m)", min_value=0.0, step=1.0)
        
        with col3:
            num_children = st.selectbox("تعداد فرزندان (الگوی برش)", [1, 2, 3, 4])
            width_1 = st.number_input("عرض 1 (mm)", min_value=0.0, step=1.0, key="w1")
            width_2 = st.number_input("عرض 2 (mm)", min_value=0.0, step=1.0, key="w2")
            width_3 = st.number_input("عرض 3 (mm)", min_value=0.0, step=1.0, key="w3")
            width_4 = st.number_input("عرض 4 (mm)", min_value=0.0, step=1.0, key="w4")
        
        submitted = st.form_submit_button("ثبت ستاپ")
        
        if submitted:
            # ایجاد دیکشنری داده‌ها
            new_setup = {
                "تاریخ ثبت": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "شماره سفارش": order_number,
                "شناسه رول مادر": mother_roll_id,
                "عرض رول مادر": roll_width,
                "نوع رول": roll_type,
                "شماره دستگاه": machine_number,
                "تعداد": quantity,
                "متراژ": length,
                "تعداد فرزندان": num_children,
                "عرض 1": width_1 if num_children >= 1 else None,
                "عرض 2": width_2 if num_children >= 2 else None,
                "عرض 3": width_3 if num_children >= 3 else None,
                "عرض 4": width_4 if num_children >= 4 else None,
            }
            
            # خواندن یا ایجاد فایل اکسل
            if os.path.exists(SETUP_FILE):
                try:
                    df_existing = pd.read_excel(SETUP_FILE)
                    df_new = pd.DataFrame([new_setup])
                    df_updated = pd.concat([df_existing, df_new], ignore_index=True)
                    df_updated.to_excel(SETUP_FILE, index=False)
                    st.success("✅ ستاپ جدید با موفقیت ثبت شد!")
                except Exception as e:
                    st.error(f"خطا در خواندن فایل: {e}")
            else:
                df_new = pd.DataFrame([new_setup])
                df_new.to_excel(SETUP_FILE, index=False)
                st.success("✅ فایل ستاپ ایجاد و داده ثبت شد!")
    
    # نمایش راهنما
    st.info("""
    **راهنما:**
    - هر رول مادر می‌تواند تا 4 فرزند داشته باشد
    - عرض فرزندان باید با عرض رول مادر همخوانی داشته باشد
    - شماره دستگاه مشخص می‌کند کدام دستگاه متالایزر این رول را پردازش کند
    """)

# ============================================================
# تب 2: لیست ستاپ‌ها
# ============================================================
with tab2:
    st.header("📊 لیست ستاپ‌های ثبت شده")
    
    if os.path.exists(SETUP_FILE):
        df_setup = pd.read_excel(SETUP_FILE)
        st.dataframe(df_setup, use_container_width=True)
        
        # امکان دانلود
        csv = df_setup.to_csv(index=False).encode('utf-8-sig')
        st.download_button(
            "📥 دانلود فایل CSV",
            csv,
            "setup_data.csv",
            "text/csv",
            key='download-csv'
        )
        
        # آمار کلی
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("تعداد کل ستاپ‌ها", len(df_setup))
        with col2:
            st.metric("مجموع متراژ", f"{df_setup['متراژ'].sum():,.0f} m")
        with col3:
            st.metric("میانگین عرض", f"{df_setup['عرض رول مادر'].mean():.1f} mm")
        with col4:
            st.metric("تعداد دستگاه‌های فعال", df_setup['شماره دستگاه'].nunique())
    else:
        st.warning("هیچ ستاپی ثبت نشده است. لطفاً از تب اول اقدام به ثبت ستاپ کنید.")

# ============================================================
# تب 3: موجودی رول‌های خام
# ============================================================
with tab3:
    st.header("📦 موجودی رول‌های خام")
    
    if os.path.exists(ROLL_EXPORT_FILE):
        try:
            df_raw = read_xml_excel(ROLL_EXPORT_FILE)
            
            if not df_raw.empty:
                # نمایش داده‌ها
                st.dataframe(df_raw.head(100), use_container_width=True)
                
                # پیدا کردن ستون عرض
                width_col = None
                for col in df_raw.columns:
                    if 'عرض' in str(col) and 'اولیه' not in str(col):
                        width_col = col
                        break
                
                # نمودار توزیع عرض رول‌ها
                col1, col2 = st.columns(2)
                with col1:
                    if width_col:
                        fig_width = px.histogram(df_raw, x=width_col, title='توزیع عرض رول‌های خام',
                                                labels={width_col: 'عرض (mm)'}, color_discrete_sequence=['#3498db'])
                        st.plotly_chart(fig_width, use_container_width=True)
                
                with col2:
                    # پیدا کردن ستون نوع
                    type_col = None
                    for col in df_raw.columns:
                        if 'نوع' in str(col) or 'Type' in str(col):
                            type_col = col
                            break
                    if type_col:
                        fig_type = px.pie(df_raw, names=type_col, title='توزیع نوع رول‌ها')
                        st.plotly_chart(fig_type, use_container_width=True)
                
                # آمار
                st.subheader("آمار رول‌های خام")
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("تعداد کل رول‌ها", len(df_raw))
                with col2:
                    # پیدا کردن ستون متراژ
                    length_col = None
                    for col in df_raw.columns:
                        if 'متراژ' in str(col) or 'Length' in str(col):
                            length_col = col
                            break
                    if length_col:
                        st.metric("مجموع متراژ", f"{df_raw[length_col].sum():,.0f} m")
                with col3:
                    # پیدا کردن ستون وزن
                    weight_col = None
                    for col in df_raw.columns:
                        if 'وزن' in str(col) or 'Weight' in str(col):
                            weight_col = col
                            break
                    if weight_col:
                        st.metric("مجموع وزن", f"{df_raw[weight_col].sum():,.2f} kg")
                    
            else:
                st.warning("داده‌ای در فایل رول‌های خام یافت نشد.")
                
        except Exception as e:
            st.error(f"خطا در خواندن فایل رول‌های خام: {e}")
    else:
        st.warning("فایل Roll Export.xls یافت نشد.")

# ============================================================
# تب 4: رول‌های متالایز شده
# ============================================================
with tab4:
    st.header("✨ رول‌های متالایز شده")
    
    if os.path.exists(ARCHIVED_ROLL_FILE):
        try:
            df_archived = read_xml_excel(ARCHIVED_ROLL_FILE)
            
            if not df_archived.empty:
                st.dataframe(df_archived.head(100), use_container_width=True)
                
                # نمودار
                col1, col2 = st.columns(2)
                with col1:
                    fig = px.bar(df_archived.head(20).reset_index(drop=True), 
                                y=df_archived.head(20).iloc[:, 0] if len(df_archived.columns) > 0 else [],
                                title='نمونه رول‌های متالایز شده (20 تای اول)',
                                color_discrete_sequence=['#9b59b6'])
                    st.plotly_chart(fig, use_container_width=True)
                
                with col2:
                    st.metric("تعداد رول‌های متالایز شده", len(df_archived))
            else:
                st.warning("داده‌ای در فایل رول‌های متالایز شده یافت نشد.")
                
        except Exception as e:
            st.error(f"خطا در خواندن فایل رول‌های متالایز شده: {e}")
    else:
        st.warning("فایل Archived Roll Export.xls یافت نشد.")

# ============================================================
# تب 5: فرزندان برش شده
# ============================================================
with tab5:
    st.header("✂️ فرزندان برش شده از ستاپ‌ها")
    
    if os.path.exists(SETUP_FILE):
        df_setup = pd.read_excel(SETUP_FILE)
        
        # استخراج فرزندان
        children_data = []
        for idx, row in df_setup.iterrows():
            num_children = row.get('تعداد فرزندان', 0)
            for i in range(1, int(num_children) + 1):
                width_col = f'عرض {i}'
                if width_col in row and pd.notna(row[width_col]):
                    children_data.append({
                        "شناسه مادر": row.get('شناسه رول مادر', ''),
                        "شماره سفارش": row.get('شماره سفارش', ''),
                        "شماره فرزند": i,
                        "عرض فرزند": row[width_col],
                        "نوع رول": row.get('نوع رول', ''),
                        "متراژ": row.get('متراژ', 0)
                    })
        
        if children_data:
            df_children = pd.DataFrame(children_data)
            st.dataframe(df_children, use_container_width=True)
            
            # نمودار توزیع عرض فرزندان
            fig = px.histogram(df_children, x='عرض فرزند', 
                              title='توزیع عرض فرزندان برش شده',
                              labels={'عرض فرزند': 'عرض (mm)'},
                              color_discrete_sequence=['#e74c3c'])
            st.plotly_chart(fig, use_container_width=True)
            
            # آمار
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("تعداد کل فرزندان", len(df_children))
            with col2:
                st.metric("میانگین عرض فرزندان", f"{df_children['عرض فرزند'].mean():.1f} mm")
            with col3:
                st.metric("تعداد الگوهای مختلف", df_children['شناسه مادر'].nunique())
        else:
            st.info("هیچ فرزندی در ستاپ‌ها تعریف نشده است.")
    else:
        st.warning("هیچ ستاپی ثبت نشده است.")

# ============================================================
# تب 6: وضعیت دستگاه‌ها
# ============================================================
with tab6:
    st.header("⏱️ وضعیت و مانده زمان دستگاه‌ها")
    
    if os.path.exists(SETUP_FILE):
        df_setup = pd.read_excel(SETUP_FILE)
        
        # گروه‌بندی بر اساس دستگاه
        if 'شماره دستگاه' in df_setup.columns and 'متراژ' in df_setup.columns:
            machine_stats = df_setup.groupby('شماره دستگاه').agg({
                'متراژ': 'sum',
                'شناسه رول مادر': 'count'
            }).reset_index()
            machine_stats.columns = ['شماره دستگاه', 'مجموع متراژ', 'تعداد رول']
            
            # فرض: سرعت متالایز کردن 100 متر بر دقیقه
            METALIZING_SPEED = 100  # متر بر دقیقه
            machine_stats['زمان مورد نیاز (دقیقه)'] = machine_stats['مجموع متراژ'] / METALIZING_SPEED
            machine_stats['زمان مورد نیاز (ساعت)'] = machine_stats['زمان مورد نیاز (دقیقه)'] / 60
            
            st.dataframe(machine_stats, use_container_width=True)
            
            # نمودار زمان دستگاه‌ها
            col1, col2 = st.columns(2)
            with col1:
                fig_machine = px.bar(machine_stats, 
                                    x='شماره دستگاه', 
                                    y='زمان مورد نیاز (ساعت)',
                                    title='مانده زمان دستگاه‌ها (ساعت)',
                                    labels={'شماره دستگاه': 'دستگاه', 'زمان مورد نیاز (ساعت)': 'زمان (ساعت)'},
                                    color='زمان مورد نیاز (ساعت)',
                                    color_continuous_scale='Reds')
                st.plotly_chart(fig_machine, use_container_width=True)
            
            with col2:
                fig_pie = px.pie(machine_stats, 
                                values='تعداد رول', 
                                names='شماره دستگاه',
                                title='توزیع رول‌ها بین دستگاه‌ها')
                st.plotly_chart(fig_pie, use_container_width=True)
            
            # آمار کلی
            st.subheader("آمار کلی دستگاه‌ها")
            col1, col2, col3 = st.columns(3)
            with col1:
                total_time = machine_stats['زمان مورد نیاز (ساعت)'].sum()
                st.metric("مجموع زمان مورد نیاز", f"{total_time:.2f} ساعت")
            with col2:
                avg_time = machine_stats['زمان مورد نیاز (ساعت)'].mean()
                st.metric("میانگین زمان per دستگاه", f"{avg_time:.2f} ساعت")
            with col3:
                max_machine = machine_stats.loc[machine_stats['زمان مورد نیاز (ساعت)'].idxmax(), 'شماره دستگاه']
                st.metric("دستگاه با بیشترین بار", f"دستگاه {max_machine}")
        else:
            st.warning("ستون‌های مورد نیاز برای محاسبه وضعیت دستگاه‌ها یافت نشد.")
    else:
        st.warning("هیچ ستاپی ثبت نشده است.")

# ============================================================
# فوتر
# ============================================================
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: gray;'>
    <p>سیستم مدیریت تولید فیلم نازک PP | نسخه 1.0</p>
    <p>برای اجرای در شبکه داخلی از دستور: <code>streamlit run app.py --server.address 0.0.0.0</code> استفاده کنید</p>
</div>
""", unsafe_allow_html=True)
